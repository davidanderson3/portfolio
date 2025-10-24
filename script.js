import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  where,
  serverTimestamp,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js';

const CONFIG_ENDPOINT =
  'https://us-central1-portfolio-1023-1fa72.cloudfunctions.net/getFirebaseConfig';

const IS_ADMIN = document.body.dataset.admin === 'true';
const AUTHORIZED_OWNER_UIDS = ['KufIL6xKkPQt2eoksVkkYMLIdwG3'];
const PUBLIC_OWNER_UID = AUTHORIZED_OWNER_UIDS[0];

let db = null;
let projectsCollection = null;
let auth = null;
let unsubscribeProjects = null;
let isLoadingProjects = true;
let isAuthenticated = !IS_ADMIN;
let editingProjectId = null;
let orderSavePromise = null;

const CATEGORY_LABELS = {
  custom: 'Project'
};

const projects = [];

const state = {
  filter: 'all',
  search: '',
  lastFocused: null
};

const grid = document.querySelector('#projectsGrid');
const navContainer = document.querySelector('.nav-pills');
const STATIC_FILTER_ATTRIBUTE = 'data-filter-static';
const DYNAMIC_FILTER_ATTRIBUTE = 'data-filter-dynamic';
if (navContainer) {
  const existingPills = Array.from(navContainer.querySelectorAll('.nav-pill'));
  if (!existingPills.some((pill) => pill.dataset.filter === 'all')) {
    const allPill = document.createElement('button');
    allPill.type = 'button';
    allPill.className = 'nav-pill';
    allPill.dataset.filter = 'all';
    allPill.textContent = 'All Projects';
    navContainer.prepend(allPill);
    existingPills.unshift(allPill);
  }
  existingPills.forEach((pill) => {
    pill.setAttribute(STATIC_FILTER_ATTRIBUTE, 'true');
  });
}
const searchInput = document.querySelector('#projectSearch');
const overlay = document.querySelector('#detailOverlay');
const detailPanel = overlay.querySelector('.detail-panel');
const detailCategory = document.querySelector('#detailCategory');
const detailTitle = document.querySelector('#detailTitle');
const detailSummary = document.querySelector('#detailSummary');
const detailLinksSection = document.querySelector('#detailLinks');
const detailLinksList = detailLinksSection.querySelector('ul');
const cardTemplate = document.querySelector('#projectCardTemplate');
const detailMedia = document.querySelector('#detailMedia');
const detailImage = document.querySelector('#detailImage');
const projectForm = document.querySelector('#addProjectForm');
const projectFormFeedback = document.querySelector('#projectFormFeedback');
const linksContainer = projectForm ? projectForm.querySelector('[data-links-container]') : null;
const addLinkButton = projectForm ? projectForm.querySelector('[data-add-link]') : null;
const projectFormSubmit = projectForm ? projectForm.querySelector('.project-form__submit') : null;
const authToggleButton = document.querySelector('#authToggleButton');
const authStatus = document.querySelector('#authStatus');
const projectCreateSection = document.querySelector('.project-create');

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

function setFormDisabled(disabled = false) {
  if (!projectForm) return;
  const controls = projectForm.querySelectorAll('input, textarea, button');
  controls.forEach((control) => {
    control.disabled = disabled;
  });
}

function unsubscribeFromProjects() {
  if (typeof unsubscribeProjects === 'function') {
    unsubscribeProjects();
    unsubscribeProjects = null;
  }
}

function updateAuthUI(user) {
  if (!IS_ADMIN) {
    return;
  }

  if (!authToggleButton) return;

  if (authStatus) {
    if (user && (user.displayName || user.email)) {
      const name = user.displayName || user.email;
      authStatus.textContent = `Signed in as ${name}`;
      authStatus.hidden = false;
    } else if (!user) {
      authStatus.textContent = 'Sign in with Google to view and manage your projects.';
      authStatus.hidden = false;
    } else {
      authStatus.textContent = '';
      authStatus.hidden = true;
    }
  }

  if (user) {
    authToggleButton.textContent = 'Sign out';
    authToggleButton.disabled = false;
    setFormDisabled(false);
    if (projectCreateSection) {
      projectCreateSection.hidden = false;
    }
  } else {
    authToggleButton.textContent = 'Sign in with Google';
    authToggleButton.disabled = false;
    setFormDisabled(true);
    if (projectCreateSection) {
      projectCreateSection.hidden = true;
    }
  }
}

async function handleAuthToggle() {
  if (!auth || !IS_ADMIN) return;
  authToggleButton.disabled = true;

  try {
    if (auth.currentUser) {
      await signOut(auth);
    } else {
      await signInWithPopup(auth, googleProvider);
    }
  } catch (error) {
    console.error('Authentication flow failed', error);
    authToggleButton.disabled = false;
  }
}

function handleAuthStateChanged(user) {
  if (!IS_ADMIN) return;

  const isAllowedUser = Boolean(user) && AUTHORIZED_OWNER_UIDS.includes(user.uid);

  if (user && !isAllowedUser) {
    console.warn('Unauthorized user attempted to access admin.', { uid: user.uid });
    if (authStatus) {
      authStatus.textContent = 'This Google account is not authorized to manage this site.';
      authStatus.hidden = false;
    }
    showFormFeedback('This Google account is not authorized to manage this site.', true);
    isAuthenticated = false;
    updateAuthUI(null);
    authToggleButton.disabled = false;
    setFormDisabled(true);
    if (projectCreateSection) {
      projectCreateSection.hidden = true;
    }
    signOut(auth).catch((error) => {
      console.error('Failed to sign out unauthorized user', error);
    });
    return;
  }

  const effectiveUser = isAllowedUser ? user : null;

  isAuthenticated = Boolean(effectiveUser);
  updateAuthUI(effectiveUser);

  unsubscribeFromProjects();

  if (effectiveUser) {
    isLoadingProjects = true;
    renderFilters();
    renderProjects();
    subscribeToProjects(effectiveUser.uid);
  } else {
    projects.length = 0;
    isLoadingProjects = false;
    renderFilters();
    renderProjects();
    resetProjectForm();
    showFormFeedback('');
  }
}

async function bootstrapFirebase() {
  try {
    const response = await fetch(CONFIG_ENDPOINT, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to fetch Firebase config: ${response.status}`);
    }
    const firebaseConfig = await response.json();
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    projectsCollection = collection(db, 'projects');
    if (IS_ADMIN) {
      auth = getAuth(app);
      await setPersistence(auth, browserLocalPersistence);
      onAuthStateChanged(auth, handleAuthStateChanged);
    } else {
      subscribeToProjects();
    }
  } catch (error) {
    console.error('Failed to bootstrap Firebase', error);
    isLoadingProjects = false;
    updateAuthUI(null);
    showFormFeedback('We could not connect to Firebase. Please try again later.', true);
    renderFilters();
    renderProjects();
  }
}

// Debounce keeps the search responsive without flooding renders.
const debounce = (fn, wait = 150) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
};

const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });

function sanitizeTagList(rawTags = []) {
  const seen = new Set();
  return rawTags
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter((tag) => {
      if (!tag) return false;
      const key = tag.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function parseTagsInput(raw = '') {
  if (!raw) return [];
  return sanitizeTagList(raw.split(','));
}

function sanitizeTodosList(rawTodos = []) {
  return rawTodos
    .map((item) => {
      if (typeof item !== 'string') {
        return '';
      }
      const cleaned = item.replace(/^[\s*\-•]+/, '').trim();
      return cleaned;
    })
    .filter(Boolean);
}

function parseTodosInput(raw = '') {
  if (!raw) return [];
  const lines = raw.split(/\r?\n/);
  return sanitizeTodosList(lines);
}

function collectUniqueTags() {
  const tagMap = new Map();
  const sourceProjects = IS_ADMIN
    ? projects
    : projects.filter((project) => project.status === 'published');
  sourceProjects.forEach((project) => {
    if (!Array.isArray(project.tags)) return;
    project.tags.forEach((tag) => {
      const key = tag.toLowerCase();
      if (!tagMap.has(key)) {
        tagMap.set(key, tag);
      }
    });
  });
  return Array.from(tagMap.values()).sort((first, second) =>
    first.localeCompare(second, undefined, { sensitivity: 'base' })
  );
}

function updateActiveFilterUI() {
  if (!navContainer) return;
  const navButtons = navContainer.querySelectorAll('.nav-pill');
  navButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.filter === state.filter);
  });
}

function renderFilters() {
  if (!navContainer) return;

  const existingDynamic = navContainer.querySelectorAll(`.nav-pill[${DYNAMIC_FILTER_ATTRIBUTE}]`);
  existingDynamic.forEach((pill) => pill.remove());

  const uniqueTags = collectUniqueTags();
  uniqueTags.forEach((tag) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-pill';
    button.dataset.filter = `tag:${tag}`;
    button.setAttribute(DYNAMIC_FILTER_ATTRIBUTE, 'true');
    button.textContent = tag;
    navContainer.appendChild(button);
  });

  const navButtons = Array.from(navContainer.querySelectorAll('.nav-pill'));
  const hasActive = navButtons.some((button) => button.dataset.filter === state.filter);

  if (!hasActive) {
    state.filter = 'all';
  }

  updateActiveFilterUI();
}

function scrollGridIntoView() {
  const header = document.querySelector('.site-header');
  const headerOffset = header ? header.offsetHeight + 16 : 16;
  const targetPosition = grid.getBoundingClientRect().top + window.pageYOffset - headerOffset;
  const safePosition = targetPosition < 0 ? 0 : targetPosition;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (Math.abs(window.pageYOffset - safePosition) < 4) {
    return;
  }

  window.scrollTo({
    top: safePosition,
    behavior: prefersReducedMotion ? 'auto' : 'smooth'
  });
}

function applyFilter(filterId, options = {}) {
  const { shouldScroll = true } = options;
  state.filter = filterId;
  updateActiveFilterUI();
  renderProjects();
  if (shouldScroll) {
    scrollGridIntoView();
  }
}

function matchesFilter(project) {
  if (state.filter === 'all') return true;
  if (state.filter.startsWith('tag:')) {
    const tagValue = state.filter.slice(4).toLowerCase();
    return (
      Array.isArray(project.tags) &&
      project.tags.some((tag) => typeof tag === 'string' && tag.toLowerCase() === tagValue)
    );
  }
  return Array.isArray(project.categories) && project.categories.includes(state.filter);
}

function matchesSearch(project) {
  if (!state.search) return true;
  const term = state.search.toLowerCase();
  const haystackParts = [
    project.title,
    project.summary,
    project.caption,
    project.description,
    Array.isArray(project.tags) ? project.tags.join(' ') : '',
    Array.isArray(project.categories)
      ? project.categories.map((cat) => CATEGORY_LABELS[cat] || cat).join(' ')
      : ''
  ];
  const haystack = haystackParts
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(term);
}

function getProjectOrder(project) {
  if (Number.isFinite(project.orderIndex)) {
    return project.orderIndex;
  }
  return Number.MAX_SAFE_INTEGER;
}

function sortProjects(list) {
  list.sort((first, second) => {
    const orderDifference = getProjectOrder(first) - getProjectOrder(second);
    if (orderDifference !== 0) {
      return orderDifference;
    }

    const firstCreated = Number.isFinite(first.createdAtMillis) ? first.createdAtMillis : 0;
    const secondCreated = Number.isFinite(second.createdAtMillis) ? second.createdAtMillis : 0;

    if (firstCreated !== secondCreated) {
      return secondCreated - firstCreated;
    }

    return (first.title || '').localeCompare(second.title || '');
  });
}

function renderProjects() {
  grid.innerHTML = '';
  if (IS_ADMIN && !isAuthenticated) {
    const signedOutMessage = document.createElement('p');
    signedOutMessage.className = 'empty-state';
    signedOutMessage.textContent = 'Sign in with Google to view your project library.';
    grid.appendChild(signedOutMessage);
    return;
  }

  const filteredProjects = projects.filter((project) => {
    if (!IS_ADMIN && project.status !== 'published') {
      return false;
    }
    if (!matchesFilter(project)) {
      return false;
    }
    if (!matchesSearch(project)) {
      return false;
    }
    return true;
  });

  if (isLoadingProjects) {
    const loading = document.createElement('p');
    loading.className = 'empty-state';
    loading.textContent = 'Loading your projects...';
    grid.appendChild(loading);
    return;
  }

  if (!filteredProjects.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    const totalVisible = IS_ADMIN
      ? projects.length
      : projects.filter((project) => project.status === 'published').length;
    empty.textContent = totalVisible
      ? 'No projects match this view yet. Try another search term.'
      : 'No published projects yet. Check back soon.';
    grid.appendChild(empty);
    return;
  }

  filteredProjects.forEach((project) => {
    const card = cardTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.projectId = project.id;
    card.dataset.categories = project.categories.join(',');
    card.dataset.status = project.status;
    card.classList.toggle('is-draft', project.status !== 'published');

    const titleEl = card.querySelector('.card-title');
    if (titleEl) {
      titleEl.textContent = project.title;
    }
    const statusEl = card.querySelector('.card-status');
    if (statusEl) {
      if (IS_ADMIN) {
        statusEl.textContent = project.status === 'published' ? 'Published' : 'Draft';
        statusEl.dataset.status = project.status;
        statusEl.hidden = false;
      } else {
        statusEl.hidden = true;
      }
    }

    const expanderEl = card.querySelector('.card-expander');
    if (expanderEl) {
      expanderEl.hidden = false;
    }

    const summaryText = project.summary || project.caption || project.description || '';
    const summaryTrimmed = summaryText.trim();
    const summaryEl = card.querySelector('.card-summary');
    if (summaryEl) {
      summaryEl.textContent = summaryText;
      summaryEl.hidden = !summaryTrimmed;
    }

    let hasDescription = false;
    const descriptionEl = card.querySelector('.card-description');
    if (descriptionEl) {
      const descriptionText = project.description || '';
      descriptionEl.textContent = descriptionText;
      const descriptionTrimmed = descriptionText.trim();
      hasDescription = Boolean(descriptionTrimmed && descriptionTrimmed !== summaryTrimmed);
      descriptionEl.dataset.hasDescription = String(hasDescription);
      descriptionEl.hidden = true;
    }

    const cardHeader = card.querySelector('.card-header');
    const adminActions = card.querySelector('.card-admin-actions');
    const reorderControls = card.querySelector('.card-order-controls');
    const editButton = card.querySelector('.card-edit');
    const deleteButton = card.querySelector('.card-delete');

    if (IS_ADMIN) {
      if (adminActions) {
        adminActions.hidden = false;
      }

      if (reorderControls) {
        const moveUpButton = reorderControls.querySelector('[data-direction="up"]');
        const moveDownButton = reorderControls.querySelector('[data-direction="down"]');
        const globalIndex = projects.findIndex((item) => item.id === project.id);
        const totalProjects = projects.length;

        reorderControls.hidden = totalProjects <= 1;

        if (moveUpButton) {
          moveUpButton.disabled = globalIndex <= 0;
          moveUpButton.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await moveProject(project.id, 'up');
          });
        }

        if (moveDownButton) {
          moveDownButton.disabled = globalIndex === -1 || globalIndex >= totalProjects - 1;
          moveDownButton.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await moveProject(project.id, 'down');
          });
        }
      }

      if (editButton) {
        editButton.hidden = false;
        editButton.addEventListener('click', (event) => {
          event.stopPropagation();
          startEditingProject(project);
        });
      }

      if (deleteButton) {
        deleteButton.hidden = false;
        deleteButton.addEventListener('click', async (event) => {
          event.preventDefault();
          event.stopPropagation();
          const target = event.currentTarget;
          target.disabled = true;
          const deleted = await handleDeleteProject(project);
          if (!deleted) {
            target.disabled = false;
          }
        });
      }
    } else {
      if (adminActions) {
        adminActions.remove();
      } else if (editButton) {
        editButton.remove();
      }
      if (cardHeader && !cardHeader.children.length) {
        cardHeader.remove();
      }
    }

    const media = card.querySelector('.card-media');
    const mediaImg = media ? media.querySelector('img') : null;
    if (media && mediaImg) {
      if (project.image) {
        mediaImg.src = project.image;
        mediaImg.alt = project.alt || `Preview of ${project.title}`;
        media.hidden = false;
      } else {
        media.hidden = true;
        mediaImg.removeAttribute('src');
        mediaImg.alt = '';
      }
    }

    let hasLinks = false;
    const linksSection = card.querySelector('.card-links-section');
    const linksList = card.querySelector('.card-links');
    if (linksSection && linksList) {
      linksList.innerHTML = '';
      hasLinks = Array.isArray(project.links) && project.links.length > 0;
      if (hasLinks) {
        project.links.forEach((link) => {
          const li = document.createElement('li');
          const anchor = document.createElement('a');
          anchor.href = link.url;
          anchor.textContent = link.label;
          anchor.target = '_blank';
          anchor.rel = 'noreferrer noopener';
          li.appendChild(anchor);
          if (link.note) {
            const noteSpan = document.createElement('span');
            noteSpan.className = 'card-link-note';
            noteSpan.textContent = link.note;
            li.appendChild(noteSpan);
          }
          linksList.appendChild(li);
        });
      }
      linksSection.dataset.hasLinks = String(hasLinks);
      linksSection.hidden = true;
    }

    let hasTags = false;
    const tagsList = card.querySelector('.card-tags');
    if (tagsList) {
      if (!IS_ADMIN) {
        tagsList.remove();
      } else {
        tagsList.innerHTML = '';
        hasTags = Array.isArray(project.tags) && project.tags.length > 0;
        if (hasTags) {
          project.tags.forEach((tag) => {
            const li = document.createElement('li');
            li.textContent = tag;
            tagsList.appendChild(li);
          });
        }
        tagsList.dataset.hasTags = String(hasTags);
        tagsList.hidden = true;
      }
    }

    let hasTodos = false;
    const todosSection = card.querySelector('.card-todos');
    const todosList = todosSection ? todosSection.querySelector('ul') : null;
    if (todosSection && todosList) {
      todosList.innerHTML = '';
      hasTodos = Array.isArray(project.todos) && project.todos.length > 0;
      if (hasTodos) {
        project.todos.forEach((item) => {
          const li = document.createElement('li');
          li.textContent = item;
          todosList.appendChild(li);
        });
      }
      todosSection.dataset.hasTodos = String(hasTodos);
      todosSection.hidden = true;
    }

    const canExpand =
      hasDescription || hasLinks || hasTags || hasTodos;
    card.dataset.expandable = String(canExpand);
    card.classList.toggle('is-expandable', canExpand);
    if (canExpand) {
      card.setAttribute('aria-expanded', 'false');
      card.setAttribute('tabindex', '0');
    } else {
      card.removeAttribute('aria-expanded');
      card.removeAttribute('tabindex');
      if (expanderEl) {
        expanderEl.hidden = true;
      }
    }

    setCardExpansion(card, false);

    card.addEventListener('click', (event) => {
      if (card.dataset.expandable !== 'true') {
        return;
      }
      if (event.defaultPrevented || event.button > 0) {
        return;
      }
      if (event.target.closest('.card-admin-actions button, .card-links a, .card-links-section a')) {
        return;
      }
      toggleCardExpansion(card);
    });

    card.addEventListener('keydown', (event) => {
      if (card.dataset.expandable !== 'true') {
        return;
      }
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      if (event.target.closest('.card-admin-actions button, .card-links a, .card-links-section a')) {
        return;
      }
      event.preventDefault();
      toggleCardExpansion(card);
    });

    grid.appendChild(card);
  });
}

function setCardExpansion(card, expanded) {
  const description = card.querySelector('.card-description');
  const linksSection = card.querySelector('.card-links-section');
  const summary = card.querySelector('.card-summary');
  const tagsList = card.querySelector('.card-tags');
  const expander = card.querySelector('.card-expander');
  const todosSection = card.querySelector('.card-todos');
  const canExpand = card.dataset.expandable === 'true';
  const hasDescription = description && description.dataset.hasDescription === 'true';
  const hasLinks = linksSection && linksSection.dataset.hasLinks === 'true';
  const hasTags = tagsList && tagsList.dataset.hasTags === 'true';
  const hasTodos = todosSection && todosSection.dataset.hasTodos === 'true';
  const isExpanded = Boolean(expanded);

  if (!canExpand) {
    card.classList.remove('is-expanded');
    card.removeAttribute('aria-expanded');
    if (expander) {
      expander.hidden = true;
    }
    if (summary) {
      summary.classList.remove('card-summary--collapsed');
    }
    if (description) {
      description.hidden = true;
    }
    if (linksSection) {
      linksSection.hidden = true;
    }
    if (tagsList) {
      tagsList.hidden = !(hasTags && Boolean(tagsList.children.length));
    }
    if (todosSection) {
      todosSection.hidden = !(hasTodos && Boolean(todosSection.querySelectorAll('li').length));
    }
    return;
  }

  card.classList.toggle('is-expanded', isExpanded);
  card.setAttribute('aria-expanded', String(isExpanded));
  if (expander) {
    expander.hidden = false;
  }

  if (summary) {
    summary.classList.toggle('card-summary--collapsed', !isExpanded);
  }

  if (description) {
    description.hidden = !(isExpanded && hasDescription);
  }

  if (linksSection) {
    linksSection.hidden = !(isExpanded && hasLinks);
  }

  if (tagsList) {
    tagsList.hidden = !(isExpanded && hasTags);
  }

  if (todosSection) {
    todosSection.hidden = !(isExpanded && hasTodos);
  }

  const activeExpanded = isExpanded ? card : grid.querySelector('.project-card.is-expanded');
  applyExpansionOrdering(activeExpanded);
}

function collapseExpandedCards(exceptCard) {
  const expandedCards = grid.querySelectorAll('.project-card.is-expanded');
  expandedCards.forEach((card) => {
    if (card !== exceptCard) {
      setCardExpansion(card, false);
    }
  });
}

function applyExpansionOrdering(activeCard) {
  const cards = Array.from(grid.querySelectorAll('.project-card'));
  if (activeCard) {
    grid.classList.add('projects-grid--expanded');
    cards.forEach((card) => {
      if (card === activeCard) {
        card.style.order = '0';
      } else {
        card.style.order = '1';
      }
    });
  } else {
    grid.classList.remove('projects-grid--expanded');
    cards.forEach((card) => {
      card.style.removeProperty('order');
    });
  }
}

function toggleCardExpansion(card) {
  if (card.dataset.expandable !== 'true') {
    return;
  }
  const isExpanded = card.classList.contains('is-expanded');
  const shouldExpand = !isExpanded;
  if (shouldExpand) {
    collapseExpandedCards(card);
  }
  setCardExpansion(card, shouldExpand);
  if (shouldExpand) {
    requestAnimationFrame(() => {
      card.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
    });
  }
}

function focusReorderButton(projectId, direction) {
  if (!IS_ADMIN) {
    return;
  }

  requestAnimationFrame(() => {
    const card = grid.querySelector(`[data-project-id="${projectId}"]`);
    if (!card) {
      return;
    }

    const targetButton = card.querySelector(
      direction === 'down' ? '.card-order-controls [data-direction="down"]' : '.card-order-controls [data-direction="up"]'
    );

    if (targetButton && !targetButton.disabled) {
      targetButton.focus();
    } else {
      card.focus();
    }
  });
}

async function persistProjectOrder() {
  if (!IS_ADMIN) {
    return;
  }

  if (!projectsCollection) {
    throw new Error('Firebase is not configured.');
  }

  if (!auth || !auth.currentUser) {
    throw new Error('User is not authenticated.');
  }

  if (orderSavePromise) {
    try {
      await orderSavePromise;
    } catch (error) {
      // Ignore the error here; the next save attempt will surface it again if needed.
    }
  }

  const updates = [];

  projects.forEach((project, index) => {
    const desiredOrder = index + 1;
    if (project.orderIndex !== desiredOrder) {
      project.orderIndex = desiredOrder;
      const documentRef = doc(projectsCollection, project.id);
      updates.push(
        updateDoc(documentRef, {
          orderIndex: desiredOrder,
          updatedAt: serverTimestamp()
        })
      );
    }
  });

  if (!updates.length) {
    return;
  }

  const pendingSave = Promise.all(updates);

  orderSavePromise = pendingSave
    .catch((error) => {
      throw error;
    })
    .finally(() => {
      if (orderSavePromise === pendingSave) {
        orderSavePromise = null;
      }
    });

  return orderSavePromise;
}

async function moveProject(projectId, direction) {
  if (!IS_ADMIN) {
    return;
  }

  const currentIndex = projects.findIndex((project) => project.id === projectId);
  if (currentIndex === -1) {
    return;
  }

  const offset = direction === 'up' ? -1 : 1;
  const targetIndex = currentIndex + offset;

  if (targetIndex < 0 || targetIndex >= projects.length) {
    return;
  }

  const [movedProject] = projects.splice(currentIndex, 1);
  projects.splice(targetIndex, 0, movedProject);

  renderProjects();
  focusReorderButton(projectId, direction);

  try {
    await persistProjectOrder();
    showFormFeedback('Project order updated.');
  } catch (error) {
    console.error('Failed to persist project order', error);
    showFormFeedback('We could not update the project order. Please try again.', true);
  }
}

function showProjectDetail(project, trigger) {
  state.lastFocused = trigger || document.activeElement;
  detailCategory.textContent = CATEGORY_LABELS[project.category] || project.category;
  detailTitle.textContent = project.title;
  const detailText = project.description || project.summary || '';
  detailSummary.textContent = detailText;
  detailSummary.hidden = !detailText;

  if (detailMedia && detailImage) {
    if (project.image) {
      detailImage.src = project.image;
      detailImage.alt = project.alt || `Preview of ${project.title}`;
      detailMedia.hidden = false;
    } else {
      detailMedia.hidden = true;
      detailImage.removeAttribute('src');
      detailImage.alt = '';
    }
  }

  if (project.links && project.links.length) {
    detailLinksList.innerHTML = '';
    project.links.forEach((link) => {
      const li = document.createElement('li');
      const anchor = document.createElement('a');
      anchor.href = link.url;
      anchor.textContent = link.label;
      anchor.target = '_blank';
      anchor.rel = 'noreferrer noopener';
      li.appendChild(anchor);
      if (link.note) {
        const noteSpan = document.createElement('span');
        noteSpan.className = 'detail-link-note';
        noteSpan.textContent = link.note;
        li.appendChild(noteSpan);
      }
      detailLinksList.appendChild(li);
    });
    detailLinksSection.hidden = false;
  } else {
    detailLinksSection.hidden = true;
    detailLinksList.innerHTML = '';
  }

  overlay.hidden = false;
  requestAnimationFrame(() => {
    overlay.classList.add('is-visible');
    detailPanel.setAttribute('tabindex', '-1');
    detailPanel.focus();
  });
}

function closeProjectDetail() {
  if (overlay.hidden) return;
  overlay.classList.remove('is-visible');
  const handleTransitionEnd = () => {
    overlay.hidden = true;
    overlay.removeEventListener('transitionend', handleTransitionEnd);
  };
  overlay.addEventListener('transitionend', handleTransitionEnd);

  if (state.lastFocused) {
    state.lastFocused.focus();
    state.lastFocused = null;
  }
}

function normalizeCustomProject(raw = {}) {
  const sanitizedTitle = typeof raw.title === 'string' ? raw.title.trim() : '';
  const sanitizedSummary = typeof raw.summary === 'string' ? raw.summary.trim() : '';
  const sanitizedCaption = typeof raw.caption === 'string' ? raw.caption.trim() : '';
  const sanitizedDescription = typeof raw.description === 'string' ? raw.description.trim() : '';
  const sanitizedImage = typeof raw.image === 'string' ? raw.image.trim() : '';
  const sanitizedAlt = typeof raw.alt === 'string' ? raw.alt.trim() : '';
  const sanitizedLinks = Array.isArray(raw.links)
    ? raw.links
        .map((link) => ({
          label: typeof link.label === 'string' ? link.label.trim() : '',
          url: typeof link.url === 'string' ? link.url.trim() : '',
          note: typeof link.note === 'string' ? link.note.trim() : ''
        }))
        .filter((link) => link.label && link.url)
    : [];
  const sanitizedTags = sanitizeTagList(
    Array.isArray(raw.tags)
      ? raw.tags
      : typeof raw.tags === 'string'
        ? raw.tags.split(',')
        : []
  );
  const sanitizedTodos = sanitizeTodosList(
    Array.isArray(raw.todos)
      ? raw.todos
      : typeof raw.todos === 'string'
        ? raw.todos.split(/\r?\n/)
        : []
  );
  const sanitizedStatus =
    typeof raw.status === 'string' && raw.status.toLowerCase() === 'published' ? 'published' : 'draft';

  const sanitizedCreatedAtMillis = Number.isFinite(raw.createdAtMillis)
    ? raw.createdAtMillis
    : raw.createdAt && typeof raw.createdAt.toMillis === 'function'
      ? raw.createdAt.toMillis()
      : Date.now();

  const sanitizedOrderIndex = Number.isFinite(raw.orderIndex)
    ? raw.orderIndex
    : -sanitizedCreatedAtMillis;

  return {
    id:
      typeof raw.id === 'string' && raw.id.trim()
        ? raw.id.trim()
        : `custom-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    title: sanitizedTitle || 'Untitled project',
    summary: sanitizedSummary || sanitizedCaption,
    caption: sanitizedCaption || sanitizedSummary,
    description: sanitizedDescription,
    image: sanitizedImage,
    alt: sanitizedAlt,
    category: 'custom',
    categories:
      Array.isArray(raw.categories) && raw.categories.length
        ? raw.categories
        : ['custom'],
    tags: sanitizedTags,
    todos: sanitizedTodos,
    status: sanitizedStatus,
    links: sanitizedLinks,
    orderIndex: sanitizedOrderIndex,
    createdAtMillis: sanitizedCreatedAtMillis
  };
}

async function saveProjectToFirebase(project) {
  if (!projectsCollection) {
    throw new Error('Firebase is not configured.');
  }

  if (!IS_ADMIN || !auth || !auth.currentUser) {
    throw new Error('User is not authenticated.');
  }

  const { id, createdAtMillis, ...payload } = project;
  payload.createdAt = serverTimestamp();
  payload.ownerUid = auth.currentUser.uid;
  payload.orderIndex = Number.isFinite(project.orderIndex) ? project.orderIndex : Date.now() * -1;
  const docRef = await addDoc(projectsCollection, payload);
  return docRef.id;
}

async function updateProjectInFirebase(documentId, project) {
  if (!projectsCollection) {
    throw new Error('Firebase is not configured.');
  }

  if (!IS_ADMIN || !auth || !auth.currentUser) {
    throw new Error('User is not authenticated.');
  }

  const { id, createdAtMillis, ...payload } = project;
  payload.ownerUid = auth.currentUser.uid;
  payload.updatedAt = serverTimestamp();
  const docRef = doc(projectsCollection, documentId);
  await updateDoc(docRef, payload);
}

async function deleteProjectFromFirebase(documentId) {
  if (!projectsCollection) {
    throw new Error('Firebase is not configured.');
  }

  if (!IS_ADMIN || !auth || !auth.currentUser) {
    throw new Error('User is not authenticated.');
  }

  const docRef = doc(projectsCollection, documentId);
  await deleteDoc(docRef);
}

async function handleDeleteProject(project) {
  if (!IS_ADMIN || !project) {
    return false;
  }

  const title = project.title ? `"${project.title}"` : 'this project';
  const confirmation = window.confirm(`Delete ${title}? This action cannot be undone.`);
  if (!confirmation) {
    return false;
  }

  try {
    await deleteProjectFromFirebase(project.id);
    showFormFeedback('Project removed.');
    return true;
  } catch (error) {
    console.error('Failed to delete project', error);
    showFormFeedback('We could not delete the project. Please try again.', true);
    return false;
  }
}

function subscribeToProjects(ownerUid) {
  if (!projectsCollection) {
    console.warn('Firebase not ready; skipping project subscription.');
    isLoadingProjects = false;
    renderFilters();
    renderProjects();
    return;
  }

  if (IS_ADMIN && !ownerUid) {
    console.warn('User not authenticated; skipping admin project subscription.');
    isLoadingProjects = false;
    renderFilters();
    renderProjects();
    return;
  }

  unsubscribeFromProjects();

  const baseOrder = orderBy('createdAt', 'desc');
  const projectsQuery =
    IS_ADMIN && ownerUid
      ? query(projectsCollection, where('ownerUid', '==', ownerUid), baseOrder)
      : query(projectsCollection, baseOrder);

  isLoadingProjects = true;
  unsubscribeProjects = onSnapshot(
    projectsQuery,
    (snapshot) => {
      if (IS_ADMIN && !isAuthenticated) {
        return;
      }
      projects.length = 0;
      snapshot.forEach((docSnapshot) => {
        const project = normalizeCustomProject({ ...docSnapshot.data(), id: docSnapshot.id });
        if (!project.image || !project.summary || !project.title) {
          return;
        }
        if (!IS_ADMIN && project.status !== 'published') {
          return;
        }
        projects.push(project);
      });
      sortProjects(projects);
      isLoadingProjects = false;
      renderFilters();
      renderProjects();
    },
    (error) => {
      console.error('Failed to load projects from Firebase', error);
      isLoadingProjects = false;
      showFormFeedback('We could not load projects from Firebase.', true);
      renderFilters();
      renderProjects();
    }
  );
}

function showFormFeedback(message, isError = false) {
  if (!projectFormFeedback) return;
  projectFormFeedback.textContent = message;
  if (!message) {
    projectFormFeedback.removeAttribute('data-state');
    return;
  }
  projectFormFeedback.dataset.state = isError ? 'error' : 'success';
}

function createLinkRow(prefill = {}) {
  if (!linksContainer) return null;
  const row = document.createElement('div');
  row.className = 'project-form__link-row';

  const labelField = document.createElement('label');
  labelField.className = 'project-form__field';
  const labelSpan = document.createElement('span');
  labelSpan.className = 'project-form__label';
  labelSpan.textContent = 'Link label';
  const labelInput = document.createElement('input');
  labelInput.name = 'linkLabel';
  labelInput.type = 'text';
  labelInput.maxLength = 120;
  labelInput.placeholder = 'e.g. Live demo';
  labelInput.value = typeof prefill.label === 'string' ? prefill.label : '';
  labelField.append(labelSpan, labelInput);

  const urlField = document.createElement('label');
  urlField.className = 'project-form__field';
  const urlSpan = document.createElement('span');
  urlSpan.className = 'project-form__label';
  urlSpan.textContent = 'Link URL';
  const urlInput = document.createElement('input');
  urlInput.name = 'linkUrl';
  urlInput.type = 'url';
  urlInput.placeholder = 'https://example.com';
  urlInput.value = typeof prefill.url === 'string' ? prefill.url : '';
  urlField.append(urlSpan, urlInput);

  const noteField = document.createElement('label');
  noteField.className = 'project-form__field';
  const noteSpan = document.createElement('span');
  noteSpan.className = 'project-form__label';
  noteSpan.textContent = 'Link note';
  const noteInput = document.createElement('input');
  noteInput.name = 'linkNote';
  noteInput.type = 'text';
  noteInput.maxLength = 160;
  noteInput.placeholder = 'Optional context shown beside the link';
  noteInput.value = typeof prefill.note === 'string' ? prefill.note : '';
  noteField.append(noteSpan, noteInput);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'project-form__link-remove';
  removeButton.textContent = 'Remove';
  removeButton.addEventListener('click', () => {
    row.remove();
    if (!linksContainer.querySelector('.project-form__link-row')) {
      addLinkRow();
    }
  });

  row.append(labelField, urlField, noteField, removeButton);
  return row;
}

function addLinkRow(prefill) {
  if (!linksContainer) return;
  const row = createLinkRow(prefill);
  if (row) {
    linksContainer.appendChild(row);
  }
}

function resetLinkRows(prefillLinks = []) {
  if (!linksContainer) return;
  linksContainer.innerHTML = '';
  if (prefillLinks.length) {
    prefillLinks.forEach((link) => addLinkRow(link));
  } else {
    addLinkRow();
  }
}

function resetProjectForm() {
  if (!projectForm) return;
  projectForm.reset();
  const tagsField = projectForm.querySelector('#projectTags');
  if (tagsField) {
    tagsField.value = '';
  }
  const todosField = projectForm.querySelector('#projectTodos');
  if (todosField) {
    todosField.value = '';
  }
  const statusField = projectForm.querySelector('#projectStatus');
  if (statusField) {
    statusField.value = 'draft';
  }
  resetLinkRows();
  editingProjectId = null;
  if (projectFormSubmit) {
    projectFormSubmit.textContent = 'Add project';
  }
  projectForm.dataset.mode = 'create';
}

function startEditingProject(project) {
  if (!IS_ADMIN || !projectForm) return;

  editingProjectId = project.id;
  projectForm.dataset.mode = 'edit';
  if (projectFormSubmit) {
    projectFormSubmit.textContent = 'Update project';
  }

  const titleField = projectForm.querySelector('#projectTitle');
  const captionField = projectForm.querySelector('#projectCaption');
  const descriptionField = projectForm.querySelector('#projectDescription');
  const imageField = projectForm.querySelector('#projectImage');
  const imageUploadField = projectForm.querySelector('#projectImageUpload');
  const altField = projectForm.querySelector('#projectAltText');
  const tagsField = projectForm.querySelector('#projectTags');
  const todosField = projectForm.querySelector('#projectTodos');
  const statusField = projectForm.querySelector('#projectStatus');

  if (titleField) titleField.value = project.title || '';
  if (captionField) captionField.value = project.summary || '';
  if (descriptionField) descriptionField.value = project.description || '';
  if (imageField) imageField.value = project.image || '';
  if (imageUploadField) imageUploadField.value = '';
  if (altField) altField.value = project.alt || '';
  if (tagsField) {
    tagsField.value = Array.isArray(project.tags) ? project.tags.join(', ') : '';
  }
  if (todosField) {
    todosField.value = Array.isArray(project.todos) ? project.todos.join('\n') : '';
  }
  if (statusField) {
    statusField.value = project.status === 'published' ? 'published' : 'draft';
  }

  resetLinkRows(Array.isArray(project.links) ? project.links : []);

  showFormFeedback('Editing existing project. Update the fields and save.');
  projectForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function handleProjectSubmit(event) {
  event.preventDefault();
  if (!projectForm) return;

  const formData = new FormData(projectForm);
  const title = (formData.get('title') || '').trim();
  const caption = (formData.get('caption') || '').trim();
  const description = (formData.get('description') || '').trim();
  const imageUrl = (formData.get('image') || '').trim();
  const imageFile = formData.get('imageFile');
  const alt = (formData.get('alt') || '').trim();
  const tagsInput = (formData.get('tags') || '').trim();
  const tags = parseTagsInput(tagsInput);
  const todosInput = (formData.get('todos') || '').toString().trim();
  const todos = parseTodosInput(todosInput);
  const statusInput = ((formData.get('status') || 'draft') + '').toLowerCase();
  const status = statusInput === 'published' ? 'published' : 'draft';

  if (!title || !caption || !description) {
    showFormFeedback('Please fill in the title, caption, and description fields.', true);
    return;
  }

  let resolvedImage = imageUrl;

  if (imageFile instanceof File && imageFile.size) {
    try {
      resolvedImage = await readFileAsDataURL(imageFile);
    } catch (error) {
      console.error('Failed to read uploaded image', error);
      showFormFeedback('We could not read the uploaded picture. Try a different file or use a URL.', true);
      return;
    }
  }

  if (!resolvedImage) {
    showFormFeedback('Please upload a picture or provide a URL.', true);
    return;
  }

  const linkLabels = formData.getAll('linkLabel').map((value) => (value || '').trim());
  const linkUrls = formData.getAll('linkUrl').map((value) => (value || '').trim());
  const linkNotes = formData.getAll('linkNote').map((value) => (value || '').trim());
  const links = [];

  for (let index = 0; index < Math.max(linkLabels.length, linkUrls.length, linkNotes.length); index += 1) {
    const label = linkLabels[index] || '';
    const url = linkUrls[index] || '';
    const note = linkNotes[index] || '';

    if (!label && !url) {
      continue;
    }

    if (!url) {
      showFormFeedback('One of your project links is missing a URL. Please fill it in or remove the row.', true);
      return;
    }

    links.push({ label: label || url, url, note });
  }

  const project = normalizeCustomProject({
    title,
    summary: caption,
    caption,
    description,
    image: resolvedImage,
    alt,
    links,
    tags,
    todos,
    status
  });

  if (editingProjectId) {
    const existingProject = projects.find((item) => item.id === editingProjectId);
    if (existingProject) {
      project.orderIndex = existingProject.orderIndex;
      project.createdAtMillis = existingProject.createdAtMillis;
    }
  }

  if (!projectsCollection) {
    showFormFeedback('Firebase is not configured yet. Check your Cloud Function endpoint.', true);
    return;
  }

  showFormFeedback('Saving project...');

  try {
    if (editingProjectId) {
      await updateProjectInFirebase(editingProjectId, project);
      showFormFeedback('Project updated.');
    } else {
      await saveProjectToFirebase(project);
      showFormFeedback('Project saved to Firebase.');
    }
    resetProjectForm();
    applyFilter('all');
  } catch (error) {
    console.error('Failed to save project to Firebase', error);
    showFormFeedback('We could not save this project to Firebase. Check your configuration and try again.', true);
  }
}

if (projectForm) {
  projectForm.addEventListener('submit', handleProjectSubmit);
  resetLinkRows();
  if (addLinkButton) {
    addLinkButton.addEventListener('click', () => addLinkRow());
  }
  projectForm.dataset.mode = 'create';
}

if (authToggleButton) {
  authToggleButton.addEventListener('click', handleAuthToggle);
}

if (navContainer) {
  navContainer.addEventListener('click', (event) => {
    const pill = event.target.closest('.nav-pill');
    if (!pill || !navContainer.contains(pill)) {
      return;
    }
    const { filter } = pill.dataset;
    if (!filter || filter === state.filter) {
      return;
    }
    applyFilter(filter);
  });
}

if (searchInput) {
  searchInput.addEventListener(
    'input',
    debounce((event) => {
      state.search = event.target.value.trim();
      renderProjects();
    }, 120)
  );
}

overlay.addEventListener('click', (event) => {
  if (event.target.hasAttribute('data-dismiss')) {
    closeProjectDetail();
  }
});

detailPanel.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.stopPropagation();
    closeProjectDetail();
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeProjectDetail();
  }
});

showFormFeedback('');
updateAuthUI(null);
renderProjects();
bootstrapFirebase();
