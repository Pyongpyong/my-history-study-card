import { resolveApiBaseUrl } from '../api';

const trimLeadingSlash = (value: string) => value.replace(/^\/+/, '');

const apiBase = resolveApiBaseUrl().replace(/\/+$/, '');

export const getTeacherAssetUrl = (filename: string) =>
  `${apiBase}/assets/teachers/${trimLeadingSlash(filename)}`;

export const buildTeacherFilename = (index: number, suffix = '') => {
  const id = String(index + 1).padStart(2, '0');
  return `teacher_${id}${suffix}.avif`;
};

export const getHelperAssetUrl = (path: string | null | undefined) => {
  if (!path) {
    return null;
  }
  return `${apiBase}/${trimLeadingSlash(path)}`;
};
