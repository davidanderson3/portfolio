import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js';
import {
  addDoc,
  collection,
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
const navPills = Array.from(document.querySelectorAll('.nav-pill'));
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

  isAuthenticated = Boolean(user);
  updateAuthUI(user);

  unsubscribeFromProjects();

  if (user) {
    isLoadingProjects = true;
    renderProjects();
    subscribeToProjects(user.uid);
  } else {
    projects.length = 0;
    isLoadingProjects = false;
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

function applyFilter(filterId) {
  state.filter = filterId;
  navPills.forEach((pill) => {
    pill.classList.toggle('is-active', pill.dataset.filter === filterId);
  });
  renderProjects();
  scrollGridIntoView();
}

function matchesFilter(project) {
  if (state.filter === 'all') return true;
  return project.categories.includes(state.filter);
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

  const filteredProjects = projects.filter((project) => matchesFilter(project) && matchesSearch(project));

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
    empty.textContent = projects.length
      ? 'No projects match this view yet. Try another search term.'
      : 'No projects yet. Add one to get started.';
    grid.appendChild(empty);
    return;
  }

  filteredProjects.forEach((project) => {
    const card = cardTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.projectId = project.id;
    card.dataset.categories = project.categories.join(',');
    card.setAttribute('tabindex', '0');

    card.querySelector('.card-title').textContent = project.title;
    const summaryEl = card.querySelector('.card-summary');
    if (summaryEl) {
      const summaryText = project.summary || project.description || '';
      summaryEl.textContent = summaryText;
      summaryEl.hidden = !summaryText;
    }

    const adminActions = card.querySelector('.card-admin-actions');
    const reorderControls = card.querySelector('.card-order-controls');
    const editButton = card.querySelector('.card-edit');

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
    } else {
      if (adminActions) {
        adminActions.remove();
      } else if (editButton) {
        editButton.remove();
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

    const linksSection = card.querySelector('.card-links-section');
    const linksList = card.querySelector('.card-links');
    if (linksSection && linksList) {
      linksList.innerHTML = '';
      if (project.links && project.links.length) {
        project.links.forEach((link) => {
          const li = document.createElement('li');
          const anchor = document.createElement('a');
          anchor.href = link.url;
          anchor.textContent = link.label;
          anchor.target = '_blank';
          anchor.rel = 'noreferrer noopener';
          li.appendChild(anchor);
          linksList.appendChild(li);
        });
        linksSection.hidden = false;
      } else {
        linksSection.hidden = true;
      }
    }

    const tagsList = card.querySelector('.card-tags');
    if (tagsList) {
      tagsList.innerHTML = '';
      if (Array.isArray(project.tags) && project.tags.length) {
        tagsList.hidden = false;
        project.tags.forEach((tag) => {
          const li = document.createElement('li');
          li.textContent = tag;
          tagsList.appendChild(li);
        });
      } else {
        tagsList.hidden = true;
      }
    }

    grid.appendChild(card);
  });
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
          url: typeof link.url === 'string' ? link.url.trim() : ''
        }))
        .filter((link) => link.label && link.url)
    : [];

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
    tags: Array.isArray(raw.tags) ? raw.tags : [],
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

function subscribeToProjects(ownerUid) {
  if (!projectsCollection) {
    console.warn('Firebase not ready; skipping project subscription.');
    isLoadingProjects = false;
    renderProjects();
    return;
  }

  if (IS_ADMIN && !ownerUid) {
    console.warn('User not authenticated; skipping admin project subscription.');
    isLoadingProjects = false;
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
        projects.push(project);
      });
      sortProjects(projects);
      isLoadingProjects = false;
      renderProjects();
    },
    (error) => {
      console.error('Failed to load projects from Firebase', error);
      isLoadingProjects = false;
      showFormFeedback('We could not load projects from Firebase.', true);
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

  row.append(labelField, urlField, removeButton);
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

  if (titleField) titleField.value = project.title || '';
  if (captionField) captionField.value = project.summary || '';
  if (descriptionField) descriptionField.value = project.description || '';
  if (imageField) imageField.value = project.image || '';
  if (imageUploadField) imageUploadField.value = '';
  if (altField) altField.value = project.alt || '';

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
  const links = [];

  for (let index = 0; index < Math.max(linkLabels.length, linkUrls.length); index += 1) {
    const label = linkLabels[index] || '';
    const url = linkUrls[index] || '';

    if (!label && !url) {
      continue;
    }

    if (!url) {
      showFormFeedback('One of your project links is missing a URL. Please fill it in or remove the row.', true);
      return;
    }

    links.push({ label: label || url, url });
  }

  const project = normalizeCustomProject({
    title,
    summary: caption,
    caption,
    description,
    image: resolvedImage,
    alt,
    links
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

navPills.forEach((pill) => {
  pill.addEventListener('click', () => applyFilter(pill.dataset.filter));
});

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
