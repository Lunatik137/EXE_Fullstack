export const getRecipeImageUrl = (image, baseUrl = "") => {
  if (!image || typeof image !== "string") {
    return "";
  }

  const normalizedImage = image.trim();
  if (!normalizedImage) {
    return "";
  }

  if (/^https?:\/\//i.test(normalizedImage)) {
    return normalizedImage;
  }

  if (normalizedImage.startsWith("/images/") || normalizedImage.startsWith("/uploads/")) {
    return `${baseUrl}${normalizedImage}`;
  }

  if (normalizedImage.startsWith("uploads/") || normalizedImage.startsWith("images/")) {
    return `${baseUrl}/${normalizedImage}`;
  }

  return `${baseUrl}/uploads/foods/${normalizedImage}`;
};
