import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js';
import {
  addDoc,
  collection,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js';

const CONFIG_ENDPOINT =
  'https://us-central1-decision-maker-4e1d3.cloudfunctions.net/getFirebaseConfig';

let db = null;
let projectsCollection = null;
let isLoadingProjects = true;

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
const detailOutcome = document.querySelector('#detailOutcome');
const detailStack = document.querySelector('#detailStack');
const detailTimeline = document.querySelector('#detailTimeline');
const detailHighlights = document.querySelector('#detailHighlights');
const detailLinksSection = document.querySelector('#detailLinks');
const detailLinksList = detailLinksSection.querySelector('ul');
const detailHighlightsSection = document.querySelector('.detail-highlights');
const cardTemplate = document.querySelector('#projectCardTemplate');
const detailMedia = document.querySelector('#detailMedia');
const detailImage = document.querySelector('#detailImage');
const detailDescriptionSection = document.querySelector('#detailDescriptionSection');
const detailDescription = document.querySelector('#detailDescription');
const projectForm = document.querySelector('#addProjectForm');
const projectFormFeedback = document.querySelector('#projectFormFeedback');
const linksContainer = projectForm ? projectForm.querySelector('[data-links-container]') : null;
const addLinkButton = projectForm ? projectForm.querySelector('[data-add-link]') : null;

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
    subscribeToProjects();
  } catch (error) {
    console.error('Failed to bootstrap Firebase', error);
    isLoadingProjects = false;
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
    project.outcome,
    project.timeline,
    Array.isArray(project.stack) ? project.stack.join(' ') : '',
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

function renderProjects() {
  grid.innerHTML = '';
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

    card.querySelector('.card-category').textContent = CATEGORY_LABELS[project.category] || project.category;
    card.querySelector('.card-title').textContent = project.title;
    card.querySelector('.card-summary').textContent = project.summary;

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

    const tagsList = card.querySelector('.card-tags');
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

    const openDetail = () => showProjectDetail(project, card.querySelector('.card-focus'));

    card.querySelector('.card-focus').addEventListener('click', (event) => {
      event.stopPropagation();
      openDetail();
    });

    card.addEventListener('click', openDetail);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openDetail();
      }
    });

    grid.appendChild(card);
  });
}

function showProjectDetail(project, trigger) {
  state.lastFocused = trigger || document.activeElement;
  detailCategory.textContent = CATEGORY_LABELS[project.category] || project.category;
  detailTitle.textContent = project.title;
  detailSummary.textContent = project.summary || '';

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

  if (detailDescriptionSection && detailDescription) {
    if (project.description) {
      detailDescription.textContent = project.description;
      detailDescriptionSection.hidden = false;
    } else {
      detailDescription.textContent = '';
      detailDescriptionSection.hidden = true;
    }
  }

  detailOutcome.textContent = project.outcome || 'Coming soon';
  detailStack.textContent = Array.isArray(project.stack) && project.stack.length ? project.stack.join(', ') : 'Coming soon';
  detailTimeline.textContent = project.timeline || 'Coming soon';

  detailHighlights.innerHTML = '';
  if (Array.isArray(project.highlights) && project.highlights.length) {
    project.highlights.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      detailHighlights.appendChild(li);
    });
    if (detailHighlightsSection) {
      detailHighlightsSection.hidden = false;
    }
  } else if (detailHighlightsSection) {
    detailHighlightsSection.hidden = true;
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
    outcome: typeof raw.outcome === 'string' ? raw.outcome : '',
    timeline: typeof raw.timeline === 'string' ? raw.timeline : '',
    stack: Array.isArray(raw.stack) ? raw.stack : [],
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    highlights: Array.isArray(raw.highlights) ? raw.highlights : [],
    links: sanitizedLinks
  };
}

async function saveProjectToFirebase(project) {
  if (!projectsCollection) {
    throw new Error('Firebase is not configured.');
  }

  const { id, ...payload } = project;
  payload.createdAt = serverTimestamp();
  const docRef = await addDoc(projectsCollection, payload);
  return docRef.id;
}

function subscribeToProjects() {
  if (!projectsCollection) {
    console.warn('Firebase not configured; skipping project subscription.');
    showFormFeedback('Firebase is not configured. Check your Cloud Function endpoint.', true);
    isLoadingProjects = false;
    renderProjects();
    return;
  }

  const projectsQuery = query(projectsCollection, orderBy('createdAt', 'desc'));
  isLoadingProjects = true;
  onSnapshot(
    projectsQuery,
    (snapshot) => {
      projects.length = 0;
      snapshot.forEach((docSnapshot) => {
        const project = normalizeCustomProject({ ...docSnapshot.data(), id: docSnapshot.id });
        if (!project.image || !project.summary || !project.title) {
          return;
        }
        projects.push(project);
      });
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

function resetLinkRows() {
  if (!linksContainer) return;
  linksContainer.innerHTML = '';
  addLinkRow();
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

  if (!projectsCollection) {
    showFormFeedback('Firebase is not configured yet. Check your Cloud Function endpoint.', true);
    return;
  }

  showFormFeedback('Saving project...');

  try {
    await saveProjectToFirebase(project);
    projectForm.reset();
    resetLinkRows();
    applyFilter('all');
    showFormFeedback('Project saved to Firebase.');
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
}

navPills.forEach((pill) => {
  pill.addEventListener('click', () => applyFilter(pill.dataset.filter));
});

searchInput.addEventListener(
  'input',
  debounce((event) => {
    state.search = event.target.value.trim();
    renderProjects();
  }, 120)
);

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
renderProjects();
bootstrapFirebase();
