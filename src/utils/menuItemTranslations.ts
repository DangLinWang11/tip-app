export interface MenuItemTranslation {
  name?: string;
  description?: string;
}

export interface MenuItemTranslations {
  es?: MenuItemTranslation;
}

export interface MenuItemLike {
  name?: string;
  description?: string;
  translations?: MenuItemTranslations;
}

export const getTranslatedMenuItemText = (
  item: MenuItemLike | null | undefined,
  language: string
): { name: string; description?: string } => {
  const baseName = item?.name ?? '';
  const baseDescription = item?.description ?? '';

  if (language === 'es') {
    const es = item?.translations?.es;
    return {
      name: (es?.name && es.name.trim()) || baseName,
      description: (es?.description && es.description.trim()) || baseDescription
    };
  }

  return { name: baseName, description: baseDescription };
};
