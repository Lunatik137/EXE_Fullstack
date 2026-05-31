const isAbsoluteUrl = (value) => /^https?:\/\//i.test(value);

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

export const getAvatarUrl = (avatar, baseUrl, fallbackName = 'User', size = 100) => {
  if (avatar) {
    if (isAbsoluteUrl(avatar)) {
      return avatar;
    }

    const normalizedBaseUrl = trimTrailingSlash(baseUrl || '');

    if (avatar.startsWith('/')) {
      return `${normalizedBaseUrl}${avatar}`;
    }

    if (avatar.startsWith('uploads/') || avatar.startsWith('images/')) {
      return `${normalizedBaseUrl}/${avatar}`;
    }

    return `${normalizedBaseUrl}/uploads/${avatar}`;
  }

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=10b981&color=fff&size=${size}`;
};
