export function parseStockStagingConfig(raw, siteKey, currentProject) {
  let input;
  try {
    input = JSON.parse(raw || 'null');
  } catch {
    throw new Error('VITE_STAGING_FIREBASE_CONFIG phải là JSON hợp lệ.');
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Thiếu VITE_STAGING_FIREBASE_CONFIG. Lấy cấu hình web từ dự án Firebase staging.');
  }

  const { projectId, appId, apiKey, authDomain, firestoreDatabaseId } = input;
  if (typeof projectId !== 'string' || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId) || projectId.startsWith('demo-')) {
    throw new Error('Cần mã dự án Firebase staging hợp lệ.');
  }
  if (projectId === currentProject) {
    throw new Error('Dự án staging phải khác dự án Firebase đang vận hành.');
  }
  if (typeof appId !== 'string' || !/^1:\d+:web:[a-f0-9]+$/i.test(appId) ||
    typeof apiKey !== 'string' || !/^[\w-]{20,}$/.test(apiKey) || authDomain !== `${projectId}.firebaseapp.com`) {
    throw new Error('Cần appId, apiKey và authDomain của ứng dụng web trong dự án staging.');
  }
  if (firestoreDatabaseId !== 'legacy') {
    throw new Error('Đặt firestoreDatabaseId là legacy, cơ sở dùng để kiểm tra đăng nhập của bản staging.');
  }
  if (typeof siteKey !== 'string' || !/^[\w-]{20,}$/.test(siteKey.trim()) || /my_|example|placeholder/i.test(siteKey.trim())) {
    throw new Error('Cần VITE_STAGING_FIREBASE_APPCHECK_SITE_KEY của ứng dụng web staging.');
  }

  return { projectId, appId, apiKey, authDomain, firestoreDatabaseId };
}
