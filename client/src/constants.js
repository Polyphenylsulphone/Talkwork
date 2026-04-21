export const COLLEGES = [
  {
    id: 'engineering',
    label: '工科',
    emoji: '⚙️',
    registerImageUrl: 'https://placehold.co/480x280/1a56db/ffffff?text=%E5%B7%A5%E7%A7%91',
  },
  {
    id: 'science',
    label: '理科',
    emoji: '🔬',
    registerImageUrl: 'https://placehold.co/480x280/7c3aed/ffffff?text=%E7%90%86%E7%A7%91',
  },
  {
    id: 'liberal',
    label: '文科',
    emoji: '📚',
    registerImageUrl: 'https://placehold.co/480x280/ea580c/ffffff?text=%E6%96%87%E7%A7%91',
  },
  {
    id: 'other',
    label: '其他',
    emoji: '🌤️',
    registerImageUrl: 'https://placehold.co/480x280/059669/ffffff?text=%E5%85%B6%E4%BB%96',
  },
];

export function collegeLabel(id) {
  return COLLEGES.find((c) => c.id === id)?.label || '其他';
}

export function collegeColor(id) {
  const map = {
    engineering: '#facc15',
    science: '#6b7280',
    liberal: '#FCBFCB',
    other: '#059669',
  };
  return map[id] || '#6b7280';
}
