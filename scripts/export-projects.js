const fs = require('fs');
const path = require('path');

const admin = require('firebase-admin');

const SERVICE_ACCOUNT_PATH = path.resolve(
  __dirname,
  '..',
  'portfolio-1023-1fa72-firebase-adminsdk-fbsvc-6d95a7321a.json'
);
const OUTPUT_PATH = path.resolve(__dirname, '..', 'projects.json');
const PROJECTS_CACHE_VERSION = 1;

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

function sanitizeTodosList(rawTodos = []) {
  return rawTodos
    .map((todo) => (typeof todo === 'string' ? todo.trim() : ''))
    .filter(Boolean);
}

function normalizeProject(docSnapshot) {
  const raw = docSnapshot.data() || {};
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
    Array.isArray(raw.tags) ? raw.tags : typeof raw.tags === 'string' ? raw.tags.split(',') : []
  );
  const sanitizedTodos = sanitizeTodosList(
    Array.isArray(raw.todos) ? raw.todos : typeof raw.todos === 'string' ? raw.todos.split(/\r?\n/) : []
  );
  const sanitizedStatus =
    typeof raw.status === 'string' && raw.status.toLowerCase() === 'published' ? 'published' : 'draft';

  const createdAtMillis =
    Number.isFinite(raw.createdAtMillis) && raw.createdAtMillis > 0
      ? raw.createdAtMillis
      : raw.createdAt && typeof raw.createdAt.toMillis === 'function'
        ? raw.createdAt.toMillis()
        : Date.now();

  const orderIndex = Number.isFinite(raw.orderIndex)
    ? raw.orderIndex
    : -createdAtMillis;

  return {
    id:
      typeof raw.id === 'string' && raw.id.trim()
        ? raw.id.trim()
        : docSnapshot.id,
    title: sanitizedTitle || 'Untitled project',
    summary: sanitizedSummary || sanitizedCaption,
    caption: sanitizedCaption || sanitizedSummary,
    description: sanitizedDescription,
    image: sanitizedImage,
    alt: sanitizedAlt,
    category: 'custom',
    categories:
      Array.isArray(raw.categories) && raw.categories.length ? raw.categories : ['custom'],
    tags: sanitizedTags,
    todos: sanitizedTodos,
    status: sanitizedStatus,
    links: sanitizedLinks,
    orderIndex,
    createdAtMillis
  };
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

function ensureServiceAccount() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    throw new Error(`Service account key not found at ${SERVICE_ACCOUNT_PATH}`);
  }
  return require(SERVICE_ACCOUNT_PATH);
}

async function exportProjects() {
  const serviceAccount = ensureServiceAccount();
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  const db = admin.firestore();
  const snapshot = await db.collection('projects').where('status', '==', 'published').get();

  const items = snapshot.docs
    .map((doc) => normalizeProject(doc))
    .filter((project) => project.image && project.summary && project.title);

  sortProjects(items);

  const payload = {
    version: PROJECTS_CACHE_VERSION,
    cachedAt: Date.now(),
    items
  };

  await fs.promises.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2));

  console.log(`Wrote ${items.length} published project(s) to ${OUTPUT_PATH}`);
  process.exit(0);
}

exportProjects().catch((error) => {
  console.error('Failed to export projects', error);
  process.exit(1);
});
