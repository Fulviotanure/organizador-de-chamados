// ==========================================================================
// UI Module: Enterprise Vector Icon System (Conciliador Pulse Enterprise)
// High-precision filled/duotone rounded-vector SVGs + Automatic DOM Upgrader
// ==========================================================================

(function () {
  const ICON_DEFS = {
    // --- 1. Sidebar Fixed Filter Icons (Exact Match to Reference Design) ---
    'bolt': {
      color: '#F59E0B',
      svg: '<path d="M13.5 2L4.5 13.5H11.5L10.5 22L19.5 10.5H12.5L13.5 2Z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>'
    },
    'user-check': {
      color: '#38BDF8',
      svg: '<circle cx="9" cy="7.5" r="4" fill="currentColor"/><path d="M2 19.5C2 16.46 5.13 14 9 14C12.87 14 16 16.46 16 19.5V20.5C16 21.05 15.55 21.5 15 21.5H3C2.45 21.5 2 21.05 2 20.5V19.5Z" fill="currentColor"/><path d="M16.5 11.5L18.5 13.5L22.5 9.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'
    },
    'inbox': {
      color: '#C084FC',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M5.4 3.5C4.52 3.5 3.76 4.08 3.5 4.92L2.08 13.4C2.03 13.68 2 13.97 2 14.26V18.5C2 19.88 3.12 21 4.5 21H19.5C20.88 21 22 19.88 22 18.5V14.26C22 13.97 21.97 13.68 21.92 13.4L20.5 4.92C20.24 4.08 19.48 3.5 18.6 3.5H5.4ZM5.6 6H18.4L19.6 13H15.5C15.5 14.93 13.93 16.5 12 16.5C10.07 16.5 8.5 14.93 8.5 13H4.4L5.6 6Z" fill="currentColor"/>'
    },
    'rocket': {
      color: '#818CF8',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M19.88 4.12C20.12 3.88 20.22 3.52 20.12 3.19C20.02 2.86 19.74 2.62 19.4 2.56C16.22 2.02 12.63 3.18 10.12 5.69L8.58 7.23L5.12 6.65C4.55 6.55 3.97 6.79 3.64 7.26L2.14 9.38C1.74 9.94 1.84 10.71 2.36 11.16L5.58 13.92L10.08 18.42L12.84 21.64C13.29 22.16 14.06 22.26 14.62 21.86L16.74 20.36C17.21 20.03 17.45 19.45 17.35 18.88L16.77 15.42L18.31 13.88C20.82 11.37 21.98 7.78 21.44 4.6C21.38 4.26 21.14 3.98 20.81 3.88ZM14.5 9.5C15.33 9.5 16 8.83 16 8C16 7.17 15.33 6.5 14.5 6.5C13.67 6.5 13 7.17 13 8C13 8.83 13.67 9.5 14.5 9.5ZM4.5 16.5C3.12 17.88 2.5 21.5 2.5 21.5C2.5 21.5 6.12 20.88 7.5 19.5C8.33 18.67 8.33 17.33 7.5 16.5C6.67 15.67 5.33 15.67 4.5 16.5Z" fill="currentColor"/>'
    },
    'hourglass': {
      color: '#F59E0B',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M6 2C5.45 2 5 2.45 5 3C5 3.55 5.45 4 6 4V6.5C6 8.62 7.1 10.48 8.76 11.55C7.1 12.62 6 14.48 6 16.6V20C5.45 20 5 20.45 5 21C5 21.55 5.45 22 6 22H18C18.55 22 19 21.55 19 21C19 20.45 18.55 20 18 20V16.6C18 14.48 16.9 12.62 15.24 11.55C16.9 10.48 18 8.62 18 6.5V4C18.55 4 19 3.55 19 3C19 2.45 18.55 2 18 2H6ZM8 4H16V6.5C16 8.43 14.21 10 12 10C9.79 10 8 8.43 8 6.5V4ZM12 13.5C9.79 13.5 8 15.07 8 17V20H16V17C16 15.07 14.21 13.5 12 13.5Z" fill="currentColor"/>'
    },
    'search-arrow': {
      color: '#34D399',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M10.5 3C6.36 3 3 6.36 3 10.5C3 14.64 6.36 18 10.5 18C12.23 18 13.82 17.41 15.09 16.43L19.33 20.67C19.72 21.06 20.35 21.06 20.74 20.67C21.13 20.28 21.13 19.65 20.74 19.26L16.5 15.02C17.44 13.76 18 12.2 18 10.5C18 6.36 14.64 3 10.5 3ZM7.5 10.5C7.5 9.95 7.95 9.5 8.5 9.5H10.5V7.8C10.5 7.45 10.92 7.28 11.17 7.53L13.8 10.15C14 10.35 14 10.65 13.8 10.85L11.17 13.47C10.92 13.72 10.5 13.55 10.5 13.2V11.5H8.5C7.95 11.5 7.5 11.05 7.5 10.5Z" fill="currentColor"/>'
    },
    'check-circle': {
      color: '#34D399',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM16.7 9.7C17.09 9.31 17.09 8.68 16.7 8.29C16.31 7.9 15.68 7.9 15.29 8.29L10.5 13.08L8.71 11.29C8.32 10.9 7.69 10.9 7.3 11.29C6.91 11.68 6.91 12.31 7.3 12.7L9.79 15.19C10.18 15.58 10.81 15.58 11.2 15.19L16.7 9.7Z" fill="currentColor"/>'
    },
    'calendar-today': {
      color: '#2DD4BF',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M7 2C6.45 2 6 2.45 6 3V4H5C3.34 4 2 5.34 2 7V19C2 20.66 3.34 22 5 22H19C20.66 22 22 20.66 22 19V7C22 5.34 20.66 4 19 4H18V3C18 2.45 17.55 2 17 2C16.45 2 16 2.45 16 3V4H8V3C8 2.45 7.55 2 7 2ZM4 9V19C4 19.55 4.45 20 5 20H19C19.55 20 20 19.55 20 19V9H4ZM7.5 12C6.95 12 6.5 12.45 6.5 13V16C6.5 16.55 6.95 17 7.5 17H10.5C11.05 17 11.5 16.55 11.5 16V13C11.5 12.45 11.05 12 10.5 12H7.5Z" fill="currentColor"/>'
    },
    'book': {
      color: '#60A5FA',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M6 2C4.34 2 3 3.34 3 5V19C3 20.66 4.34 22 6 22H19C20.1 22 21 21.1 21 20V4C21 2.9 20.1 2 19 2H6ZM13 4V11L15.5 9.25L18 11V4H13ZM6 18H18V20H6C5.45 20 5 19.55 5 19C5 18.45 5.45 18 6 18Z" fill="currentColor"/>'
    },
    'warning': {
      color: '#FB7185',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M10.29 3.86C11.06 2.52 12.94 2.52 13.71 3.86L21.71 17.75C22.47 19.08 21.51 20.75 19.99 20.75H4.01C2.49 20.75 1.53 19.08 2.29 17.75L10.29 3.86ZM12 8.5C11.45 8.5 11 8.95 11 9.5V13.5C11 14.05 11.45 14.5 12 14.5C12.55 14.5 13 14.05 13 13.5V9.5C13 8.95 12.55 8.5 12 8.5ZM12 18C12.69 18 13.25 17.44 13.25 16.75C13.25 16.06 12.69 15.5 12 15.5C11.31 15.5 10.75 16.06 10.75 16.75C10.75 17.44 11.31 18 12 18Z" fill="currentColor"/>'
    },
    'flame': {
      color: '#FB923C',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M12.96 2.25C12.62 1.94 12.06 2.09 11.95 2.54C11.23 5.42 8.5 6.88 8.5 10.2C8.5 11.35 9.12 12.38 10.05 12.88C9.22 12.65 8.25 11.95 7.92 10.72C7.8 10.27 7.22 10.15 6.91 10.5C5.67 11.89 5 13.66 5 15.5C5 19.37 8.13 22.5 12 22.5C15.87 22.5 19 19.37 19 15.5C19 10.12 15.95 4.98 12.96 2.25ZM12 19.5C10.07 19.5 8.5 17.93 8.5 16C8.5 14.62 9.4 13.45 10.65 12.95C11.2 14.2 12.45 15 13.9 15C14.35 15 14.78 14.91 15.17 14.75C15.38 15.13 15.5 15.55 15.5 16C15.5 17.93 13.93 19.5 12 19.5Z" fill="currentColor"/>'
    },
    'star': {
      color: '#FBBF24',
      svg: '<path d="M12 2.5L14.85 8.28L21.23 9.21L16.61 13.71L17.7 20.06L12 17.06L6.3 20.06L7.39 13.71L2.77 9.21L9.15 8.28L12 2.5Z" fill="currentColor" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>'
    },
    'star-outline': {
      color: '#64748B',
      svg: '<path d="M12 3.2L14.6 8.48L20.43 9.33L16.21 13.44L17.2 19.25L12 16.51L6.8 19.25L7.79 13.44L3.57 9.33L9.4 8.48L12 3.2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'
    },
    'ban': {
      color: '#64748B',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM4.5 12C4.5 7.86 7.86 4.5 12 4.5C13.66 4.5 15.19 5.04 16.43 5.95L5.95 16.43C5.04 15.19 4.5 13.66 4.5 12ZM12 19.5C10.34 19.5 8.81 18.96 7.57 18.05L18.05 7.57C18.96 8.81 19.5 10.34 19.5 12C19.5 16.14 16.14 19.5 12 19.5Z" fill="currentColor"/>'
    },
    'receipt-ticket': {
      color: '#34D399',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M5 3C3.9 3 3 3.9 3 5V20.5L5.25 19L7.5 20.5L9.75 19L12 20.5L14.25 19L16.5 20.5L18.75 19L21 20.5V5C21 3.9 20.1 3 19 3H5ZM7.5 7.5C6.95 7.5 6.5 7.95 6.5 8.5C6.5 9.05 6.95 9.5 7.5 9.5H16.5C17.05 9.5 17.5 9.05 17.5 8.5C17.5 7.95 17.05 7.5 16.5 7.5H7.5ZM7.5 11.5C6.95 11.5 6.5 11.95 6.5 12.5C6.5 13.05 6.95 13.5 7.5 13.5H16.5C17.05 13.5 17.5 13.05 17.5 12.5C17.5 11.95 17.05 11.5 16.5 11.5H7.5ZM7.5 15.5C6.95 15.5 6.5 15.95 6.5 16.5C6.5 17.05 6.95 17.5 7.5 17.5H13.5C14.05 17.5 14.5 17.05 14.5 16.5C14.5 15.95 14.05 15.5 13.5 15.5H7.5Z" fill="currentColor"/>'
    },

    // --- 2. Global App, Navigation, Actions & Modal Icons ---
    'search': {
      color: '#94A3B8',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M10.5 3.5C6.63 3.5 3.5 6.63 3.5 10.5C3.5 14.37 6.63 17.5 10.5 17.5C12.14 17.5 13.65 16.94 14.84 15.99L18.92 20.08C19.36 20.52 20.08 20.52 20.52 20.08C20.96 19.64 20.96 18.92 20.52 18.48L16.44 14.39C17.39 13.2 17.95 11.69 17.95 10.05C17.95 6.18 14.37 3.5 10.5 3.5ZM5.75 10.5C5.75 7.88 7.88 5.75 10.5 5.75C13.12 5.75 15.25 7.88 15.25 10.5C15.25 13.12 13.12 15.25 10.5 15.25C7.88 15.25 5.75 13.12 5.75 10.5Z" fill="currentColor"/>'
    },
    'settings': {
      color: '#94A3B8',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M10.32 2.75C10.58 1.92 11.42 1.92 12 1.92C12.58 1.92 13.42 1.92 13.68 2.75L14.2 4.38C14.78 4.61 15.32 4.92 15.81 5.31L17.46 4.86C18.29 4.63 19.01 5.35 18.78 6.18L18.33 7.83C18.72 8.32 19.03 8.86 19.26 9.44L20.89 9.96C21.72 10.22 21.72 11.78 20.89 12.04L19.26 12.56C19.03 13.14 18.72 13.68 18.33 14.17L18.78 15.82C19.01 16.65 18.29 17.37 17.46 17.14L15.81 16.69C15.32 17.08 14.78 17.39 14.2 17.62L13.68 19.25C13.42 20.08 10.58 20.08 10.32 19.25L9.8 17.62C9.22 17.39 8.68 17.08 8.19 16.69L6.54 17.14C5.71 17.37 4.99 16.65 5.22 15.82L5.67 14.17C5.28 13.68 4.97 13.14 4.74 12.56L3.11 12.04C2.28 11.78 2.28 10.22 3.11 9.96L4.74 9.44C4.97 8.86 5.28 8.32 5.67 7.83L5.22 6.18C4.99 5.35 5.71 4.63 6.54 4.86L8.19 5.31C8.68 4.92 9.22 4.61 9.8 4.38L10.32 2.75ZM12 14.25C13.79 14.25 15.25 12.79 15.25 11C15.25 9.21 13.79 7.75 12 7.75C10.21 7.75 8.75 9.21 8.75 11C8.75 12.79 10.21 14.25 12 14.25Z" fill="currentColor"/>'
    },
    'refresh': {
      color: '#38BDF8',
      svg: '<path d="M20 11C19.55 6.8 16.02 3.5 11.7 3.5C8.53 3.5 5.78 5.26 4.38 7.88M4 4.5V8.5H8M4 13C4.45 17.2 7.98 20.5 12.3 20.5C15.47 20.5 18.22 18.74 19.62 16.12M20 19.5V15.5H16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'
    },
    'table': {
      color: '#34D399',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M3 5.5C3 4.12 4.12 3 5.5 3H18.5C19.88 3 21 4.12 21 5.5V18.5C21 19.88 19.88 21 18.5 21H5.5C4.12 21 3 19.88 3 18.5V5.5ZM5.5 8.5V11.5H18.5V8.5H5.5ZM5.5 13.5V18.5H18.5V13.5H5.5Z" fill="currentColor"/>'
    },
    'kanban': {
      color: '#60A5FA',
      svg: '<rect x="3" y="3.5" width="5" height="17" rx="1.5" fill="currentColor"/><rect x="9.5" y="3.5" width="5" height="12" rx="1.5" fill="currentColor"/><rect x="16" y="3.5" width="5" height="15" rx="1.5" fill="currentColor"/>'
    },
    'plus': {
      color: '#34D399',
      svg: '<path d="M12 4.5V19.5M4.5 12H19.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'
    },
    'clock': {
      color: '#F59E0B',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 6.5C11.45 6.5 11 6.95 11 7.5V12.25C11 12.6 11.18 12.92 11.47 13.1L14.97 15.2C15.44 15.48 16.06 15.33 16.34 14.86C16.62 14.39 16.47 13.77 16 13.49L13 11.69V7.5C13 6.95 12.55 6.5 12 6.5Z" fill="currentColor"/>'
    },
    'hash': {
      color: '#60A5FA',
      svg: '<path d="M4 9H20M4 15H20M10 3L8 21M16 3L14 21" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
    },
    'close': {
      color: 'currentColor',
      svg: '<path d="M6 6L18 18M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/>'
    },
    'error': {
      color: '#FB7185',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM9.71 8.29C9.32 7.9 8.68 7.9 8.29 8.29C7.9 8.68 7.9 9.32 8.29 9.71L10.59 12L8.29 14.29C7.9 14.68 7.9 15.32 8.29 15.71C8.68 16.1 9.32 16.1 9.71 15.71L12 13.41L14.29 15.71C14.68 16.1 15.32 16.1 15.71 15.71C16.1 15.32 16.1 14.68 15.71 14.29L13.41 12L15.71 9.71C16.1 9.32 16.1 8.68 15.71 8.29C15.32 7.9 14.68 7.9 14.29 8.29L12 10.59L9.71 8.29Z" fill="currentColor"/>'
    },
    'save': {
      color: '#34D399',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M5 3C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V7.83C21 7.3 20.79 6.79 20.41 6.41L17.59 3.59C17.21 3.21 16.7 3 16.17 3H5ZM7 5V9H15V5H7ZM12 18C13.66 18 15 16.66 15 15C15 13.34 13.66 12 12 12C10.34 12 9 13.34 9 15C9 16.66 10.34 18 12 18Z" fill="currentColor"/>'
    },
    'minimize': {
      color: 'currentColor',
      svg: '<path d="M5 12H19" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'
    },
    'expand': {
      color: 'currentColor',
      svg: '<path d="M15 3H21V9M9 21H3V15M21 3L14 10M3 21L10 14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>'
    },
    'ticket': {
      color: '#FB923C',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M2 7C2 5.9 2.9 5 4 5H20C21.1 5 22 5.9 22 7V9.5C20.62 9.5 19.5 10.62 19.5 12C19.5 13.38 20.62 14.5 22 14.5V17C22 18.1 21.1 19 20 19H4C2.9 19 2 18.1 2 17V14.5C3.38 14.5 4.5 13.38 4.5 12C4.5 10.62 3.38 9.5 2 9.5V7ZM9 8.5C8.45 8.5 8 8.95 8 9.5V14.5C8 15.05 8.45 15.5 9 15.5C9.55 15.5 10 15.05 10 14.5V9.5C10 8.95 9.55 8.5 9 8.5Z" fill="currentColor"/>'
    },
    'globe': {
      color: '#38BDF8',
      svg: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.6 9H20.4M3.6 15H20.4M12 3C9.5 6 9.5 18 12 21M12 3C14.5 6 14.5 18 12 21" fill="none" stroke="currentColor" stroke-width="1.8"/>'
    },
    'layout': {
      color: '#34D399',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M3 5C3 3.9 3.9 3 5 3H19C20.1 3 21 3.9 21 5V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V5ZM5 5H19V9H5V5ZM5 11V19H10V11H5ZM12 11V19H19V11H12Z" fill="currentColor"/>'
    },
    'archive': {
      color: '#60A5FA',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M3 4C2.45 4 2 4.45 2 5V8C2 8.55 2.45 9 3 9H4V19C4 20.1 4.9 21 6 21H18C19.1 21 20 20.1 20 19V9H21C21.55 9 22 8.55 22 8V5C22 4.45 21.55 4 21 4H3ZM9.5 12C8.95 12 8.5 12.45 8.5 13C8.5 13.55 8.95 14 9.5 14H14.5C15.05 14 15.5 13.55 15.5 13C15.5 12.45 15.05 12 14.5 12H9.5Z" fill="currentColor"/>'
    },
    'file-text': {
      color: '#60A5FA',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M6 2C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2H6ZM13 3.5L18.5 9H13V3.5ZM8 12C7.45 12 7 12.45 7 13C7 13.55 7.45 14 8 14H16C16.55 14 17 13.55 17 13C17 12.45 16.55 12 16 12H8ZM8 16C7.45 16 7 16.45 7 17C7 17.55 7.45 18 8 18H13C13.55 18 14 17.55 14 17C14 16.45 13.55 16 13 16H8Z" fill="currentColor"/>'
    },
    'chat': {
      color: '#38BDF8',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M4 3C2.9 3 2 3.9 2 5V16C2 17.1 2.9 18 4 18H7L11.2 21.4C11.67 21.78 12.33 21.78 12.8 21.4L17 18H20C21.1 18 22 17.1 22 16V5C22 3.9 21.1 3 20 3H4ZM7 9.5C6.45 9.5 6 9.95 6 10.5C6 11.05 6.45 11.5 7 11.5H17C17.55 11.5 18 11.05 18 10.5C18 9.95 17.55 9.5 17 9.5H7ZM7 6.5C6.45 6.5 6 6.95 6 7.5C6 8.05 6.45 8.5 7 8.5H13C13.55 8.5 14 8.05 14 7.5C14 6.95 13.55 6.5 13 6.5H7Z" fill="currentColor"/>'
    },
    'paperclip': {
      color: '#60A5FA',
      svg: '<path d="M21.44 11.05L12.25 20.24C10.03 22.46 6.42 22.46 4.2 20.24C1.98 18.02 1.98 14.41 4.2 12.19L13.39 3C14.87 1.52 17.28 1.52 18.76 3C20.24 4.48 20.24 6.89 18.76 8.37L9.57 17.56C8.83 18.3 7.63 18.3 6.89 17.56C6.15 16.82 6.15 15.62 6.89 14.88L15.38 6.4" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>'
    },
    'note': {
      color: '#FBBF24',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M5 3C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3H5ZM7 7.5C7 6.95 7.45 6.5 8 6.5H16C16.55 6.5 17 6.95 17 7.5C17 8.05 16.55 8.5 16 8.5H8C7.45 8.5 7 8.05 7 7.5ZM8 11C7.45 11 7 11.45 7 12C7 12.55 7.45 13 8 13H16C16.55 13 17 12.55 17 12C17 11.45 16.55 11 16 11H8ZM8 15.5C7.45 15.5 7 15.95 7 16.5C7 17.05 7.45 17.5 8 17.5H12.5C13.05 17.5 13.5 17.05 13.5 16.5C13.5 15.95 13.05 15.5 12.5 15.5H8Z" fill="currentColor"/>'
    },
    'tag': {
      color: '#C084FC',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M3 5C3 3.9 3.9 3 5 3H11.17C11.7 3 12.21 3.21 12.59 3.59L20.41 11.41C21.19 12.19 21.19 13.46 20.41 14.24L14.24 20.41C13.46 21.19 12.19 21.19 11.41 20.41L3.59 12.59C3.21 12.21 3 11.7 3 11.17V5ZM7.5 9C8.33 9 9 8.33 9 7.5C9 6.67 8.33 6 7.5 6C6.67 6 6 6.67 6 7.5C6 8.33 6.67 9 7.5 9Z" fill="currentColor"/>'
    },
    'edit': {
      color: '#60A5FA',
      svg: '<path d="M16.86 3.49C17.64 2.71 18.91 2.71 19.69 3.49L20.51 4.31C21.29 5.09 21.29 6.36 20.51 7.14L8.83 18.82L4 20L5.18 15.17L16.86 3.49Z" fill="currentColor"/>'
    },
    'broom': {
      color: '#F59E0B',
      svg: '<path d="M12 2L14.2 7.8L20 10L14.2 12.2L12 18L9.8 12.2L4 10L9.8 7.8L12 2ZM19 16L19.9 18.1L22 19L19.9 19.9L19 22L18.1 19.9L16 19L18.1 18.1L19 16Z" fill="currentColor"/>'
    },
    'pin': {
      color: '#34D399',
      svg: '<path d="M16 3H8C7.45 3 7 3.45 7 4C7 4.55 7.45 5 8 5H9V10.5L6.3 13.2C5.9 13.6 6.18 14.3 6.75 14.3H11V21L12 22L13 21V14.3H17.25C17.82 14.3 18.1 13.6 17.7 13.2L15 10.5V5H16C16.55 5 17 4.55 17 4C17 3.45 16.55 3 16 3Z" fill="currentColor"/>'
    },
    'camera': {
      color: '#38BDF8',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M9 3.5L7.17 5.5H4C2.9 5.5 2 6.4 2 7.5V18.5C2 19.6 2.9 20.5 4 20.5H20C21.1 20.5 22 19.6 22 18.5V7.5C22 6.4 21.1 5.5 20 5.5H16.83L15 3.5H9ZM12 17C14.48 17 16.5 14.98 16.5 12.5C16.5 10.02 14.48 8 12 8C9.52 8 7.5 10.02 7.5 12.5C7.5 14.98 9.52 17 12 17Z" fill="currentColor"/>'
    },
    'quote': {
      color: '#94A3B8',
      svg: '<path d="M6 17H9L11 13V7H5V13H8L6 17ZM14 17H17L19 13V7H13V13H16L14 17Z" fill="currentColor"/>'
    },
    'target': {
      color: '#34D399',
      svg: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="currentColor"/>'
    },
    'trash': {
      color: '#FB7185',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M9 3C8.45 3 8 3.45 8 4V5H4C3.45 5 3 5.45 3 6C3 6.55 3.45 7 4 7H5V19C5 20.1 5.9 21 7 21H17C18.1 21 19 20.1 19 19V7H20C20.55 7 21 6.55 21 6C21 5.45 20.55 5 20 5H16V4C16 3.45 15.55 3 15 3H9ZM10 10C9.45 10 9 10.45 9 11V17C9 17.55 9.45 18 10 18C10.55 18 11 17.55 11 17V11C11 10.45 10.55 10 10 10ZM14 10C13.45 10 13 10.45 13 11V17C13 17.55 13.45 18 14 18C14.55 18 15 17.55 15 17V11C15 10.45 14.55 10 14 10Z" fill="currentColor"/>'
    },
    'image': {
      color: '#38BDF8',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M5 3C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3H5ZM8.5 10C9.33 10 10 9.33 10 8.5C10 7.67 9.33 7 8.5 7C7.67 7 7 7.67 7 8.5C7 9.33 7.67 10 8.5 10ZM19 17.5L14.5 11.5L11 16L8.5 13L5 17.5H19Z" fill="currentColor"/>'
    },
    'download': {
      color: '#34D399',
      svg: '<path d="M12 3.5V15.5M12 15.5L7.5 11M12 15.5L16.5 11M4 19.5H20" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>'
    },
    'upload': {
      color: '#C084FC',
      svg: '<path d="M12 15.5V3.5M12 3.5L7.5 8M12 3.5L16.5 8M4 19.5H20" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>'
    },
    'chevron-left': {
      color: 'currentColor',
      svg: '<path d="M15 6L9 12L15 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'
    },
    'chevron-right': {
      color: 'currentColor',
      svg: '<path d="M9 6L15 12L9 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'
    },
    'folder': {
      color: '#FBBF24',
      svg: '<path d="M4 4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V8C22 6.9 21.1 6 20 6H12L10 4H4Z" fill="currentColor"/>'
    },
    'folder-open': {
      color: '#FBBF24',
      svg: '<path d="M4 4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H19.5C20.4 20 21.18 19.4 21.43 18.54L22.86 11.54C23.16 10.27 22.2 9 20.9 9H6.5L4.5 17V6H20C20 4.9 19.1 4 18 4H11L9 4H4Z" fill="currentColor"/>'
    },
    'bank': {
      color: '#60A5FA',
      svg: '<path d="M12 2L2 7V9H22V7L12 2ZM4 11V17H7V11H4ZM10.5 11V17H13.5V11H10.5ZM17 11V17H20V11H17ZM2 19V21H22V19H2Z" fill="currentColor"/>'
    },
    'laptop': {
      color: '#38BDF8',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M4 5C4 3.9 4.9 3 6 3H18C19.1 3 20 3.9 20 5V15H22V17C22 18.1 21.1 19 20 19H4C2.9 19 2 18.1 2 17V15H4V5ZM6 5H18V15H6V5Z" fill="currentColor"/>'
    },
    'credit-card': {
      color: '#C084FC',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M2 6.5C2 5.12 3.12 4 4.5 4H19.5C20.88 4 22 5.12 22 6.5V17.5C22 18.88 20.88 20 19.5 20H4.5C3.12 20 2 18.88 2 17.5V6.5ZM2 8.5V11H22V8.5H2ZM6 15.5C6 14.95 6.45 14.5 7 14.5H11C11.55 14.5 12 14.95 12 15.5C12 16.05 11.55 16.5 11 16.5H7C6.45 16.5 6 16.05 6 15.5Z" fill="currentColor"/>'
    },
    'help-circle': {
      color: '#F59E0B',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 18C12.69 18 13.25 17.44 13.25 16.75C13.25 16.06 12.69 15.5 12 15.5C11.31 15.5 10.75 16.06 10.75 16.75C10.75 17.44 11.31 18 12 18ZM12 6.5C10.07 6.5 8.5 8.07 8.5 10H10.5C10.5 9.17 11.17 8.5 12 8.5C12.83 8.5 13.5 9.17 13.5 10C13.5 11.5 11.25 11.31 11.25 14H13.25C13.25 12.12 15.5 11.88 15.5 10C15.5 8.07 13.93 6.5 12 6.5Z" fill="currentColor"/>'
    },
    'key': {
      color: '#FBBF24',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M14.5 4C11.79 4 9.53 5.92 9.08 8.5H2V12.5H5V15.5H8V12.5H9.08C9.53 15.08 11.79 17 14.5 17C17.54 17 20 14.54 20 11.5C20 8.46 17.54 4 14.5 4ZM15.5 11.5C16.33 11.5 17 10.83 17 10C17 9.17 16.33 8.5 15.5 8.5C14.67 8.5 14 9.17 14 10C14 10.83 14.67 11.5 15.5 11.5Z" fill="currentColor"/>'
    },
    'eye': {
      color: '#38BDF8',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M12 4.5C7 4.5 2.73 7.61 1 12C2.73 16.39 7 19.5 12 19.5C17 19.5 21.27 16.39 23 12C21.27 7.61 17 4.5 12 4.5ZM12 16C9.79 16 8 14.21 8 12C8 9.79 9.79 8 12 8C14.21 8 16 9.79 16 12C16 14.21 14.21 16 12 16ZM12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14Z" fill="currentColor"/>'
    },
    'eye-off': {
      color: '#94A3B8',
      svg: '<path d="M17.94 17.94C16.23 19.24 14.21 20 12 20C7 20 2.73 16.89 1 12.5C1.92 10.17 3.49 8.18 5.5 6.84M9.9 4.74C10.58 4.58 11.28 4.5 12 4.5C17 4.5 21.27 7.61 23 12C22.34 13.68 21.35 15.19 20.09 16.43M3 3L21 21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
    },
    'bulb': {
      color: '#FBBF24',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C8.13 2 5 5.13 5 9C5 11.38 6.19 13.47 8 14.74V17C8 17.55 8.45 18 9 18H15C15.55 18 16 17.55 16 17V14.74C17.81 13.47 19 11.38 19 9C19 5.13 15.87 2 12 2ZM9.5 20C9.5 21.1 10.4 22 11.5 22H12.5C13.6 22 14.5 21.1 14.5 20H9.5Z" fill="currentColor"/>'
    },
    'terminal': {
      color: '#34D399',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M3 5C3 3.9 3.9 3 5 3H19C20.1 3 21 3.9 21 5V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V5ZM7.29 8.29C6.9 8.68 6.9 9.31 7.29 9.7L9.59 12L7.29 14.3C6.9 14.69 6.9 15.32 7.29 15.71C7.68 16.1 8.31 16.1 8.7 15.71L11.7 12.71C12.09 12.32 12.09 11.69 11.7 11.3L8.7 8.29C8.31 7.9 7.68 7.9 7.29 8.29ZM12.5 14.5C12.5 13.95 12.95 13.5 13.5 13.5H16.5C17.05 13.5 17.5 13.95 17.5 14.5C17.5 15.05 17.05 15.5 16.5 15.5H13.5C12.95 15.5 12.5 15.05 12.5 14.5Z" fill="currentColor"/>'
    },
    'cloud': {
      color: '#38BDF8',
      svg: '<path d="M18.42 9.21C17.74 5.68 14.64 3 10.9 3C6.95 3 3.7 5.98 3.3 9.83C1.42 10.46 0.1 12.24 0.1 14.35C0.1 17 2.25 19.15 4.9 19.15H18.1C20.97 19.15 23.3 16.82 23.3 13.95C23.3 11.4 21.46 9.57 18.42 9.21Z" fill="currentColor"/>'
    },
    'logout': {
      color: '#FB7185',
      svg: '<path d="M9 21H5C3.9 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H9M16 17L21 12L16 7M21 12H9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'
    },
    'info': {
      color: '#38BDF8',
      svg: '<path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 9C12.69 9 13.25 8.44 13.25 7.75C13.25 7.06 12.69 6.5 12 6.5C11.31 6.5 10.75 7.06 10.75 7.75C10.75 8.44 11.31 9 12 9ZM11 11.5C11 10.95 11.45 10.5 12 10.5C12.55 10.5 13 10.95 13 11.5V16.5C13 17.05 12.55 17.5 12 17.5C11.45 17.5 11 17.05 11 16.5V11.5Z" fill="currentColor"/>'
    },
    'play': {
      color: '#2DD4BF',
      svg: '<path d="M6.5 4.5C5.67 3.98 4.6 4.58 4.6 5.56V18.44C4.6 19.42 5.67 20.02 6.5 19.5L18.8 13.06C19.6 12.56 19.6 11.44 18.8 10.94L6.5 4.5Z" fill="currentColor"/>'
    },
    'pause': {
      color: '#FBBF24',
      svg: '<rect x="6" y="4" width="4.5" height="16" rx="1.5" fill="currentColor"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.5" fill="currentColor"/>'
    },
    'undo': {
      color: '#FBBF24',
      svg: '<path d="M9 14L4 9L9 4M4 9H15C18.31 9 21 11.69 21 15C21 18.31 18.31 21 15 21H11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'
    },
    'dot-red': {
      color: '#F43F5E',
      svg: '<circle cx="12" cy="12" r="7" fill="currentColor"/>'
    },
    'dot-yellow': {
      color: '#F59E0B',
      svg: '<circle cx="12" cy="12" r="7" fill="currentColor"/>'
    },
    'dot-orange': {
      color: '#FB923C',
      svg: '<circle cx="12" cy="12" r="7" fill="currentColor"/>'
    },
    'dot-green': {
      color: '#10B981',
      svg: '<circle cx="12" cy="12" r="7" fill="currentColor"/>'
    },
    'dot-white': {
      color: '#94A3B8',
      svg: '<circle cx="12" cy="12" r="7" fill="currentColor"/>'
    }
  };

  // Map every Fixed Filter ID directly to its semantic icon in the reference screenshot
  const FILTER_ID_ICON_MAP = {
    'all': 'bolt',
    'my_demands': 'user-check',
    'queued': 'inbox',
    'in_progress': 'rocket',
    'waiting_n2': 'hourglass',
    'review': 'search-arrow',
    'completed': 'check-circle',
    'completed_today': 'calendar-today',
    'completed_documentar': 'book',
    'errors_urgent': 'warning',
    'due_critical': 'flame',
    'favorites': 'star',
    'ignored': 'ban'
  };

  // Map emojis/symbols across the entire app to their corresponding SVG icon key
  const EMOJI_TO_ICON_KEY = {
    '⚡': 'bolt',
    '👤': 'user-check',
    '📥': 'inbox',
    '🚀': 'rocket',
    '⏳': 'hourglass',
    '🔍': 'search',
    '✅': 'check-circle',
    '✓': 'check-circle',
    '🏁': 'calendar-today',
    '📅': 'calendar-today',
    '📆': 'calendar-today',
    '🗓️': 'calendar-today',
    '🗓': 'calendar-today',
    '📑': 'book',
    '📚': 'book',
    '📕': 'book',
    '⚠️': 'warning',
    '⚠': 'warning',
    '🚨': 'warning',
    '🔥': 'flame',
    '⭐': 'star',
    '★': 'star',
    '🌟': 'star',
    '✨': 'broom',
    '🎨': 'broom',
    '☆': 'star-outline',
    '🚫': 'ban',
    '⚙️': 'settings',
    '⚙': 'settings',
    '🔄': 'refresh',
    '↺': 'refresh',
    '📋': 'table',
    '📊': 'kanban',
    '➕': 'plus',
    '⏰': 'clock',
    '🕒': 'clock',
    '🔢': 'hash',
    '✕': 'close',
    '✖': 'close',
    '❌': 'error',
    '💾': 'save',
    '🗕': 'minimize',
    '🗖': 'expand',
    '🗗': 'expand',
    '🎫': 'ticket',
    '🌐': 'globe',
    '📐': 'layout',
    '📦': 'archive',
    '🗜️': 'archive',
    '🗜': 'archive',
    '📄': 'file-text',
    '💬': 'chat',
    '🗨️': 'chat',
    '🗨': 'chat',
    '📎': 'paperclip',
    '📝': 'note',
    '🏷️': 'tag',
    '🏷': 'tag',
    '✏️': 'edit',
    '✏': 'edit',
    '🧹': 'broom',
    '📌': 'pin',
    '📷': 'camera',
    '📸': 'camera',
    '❝': 'quote',
    '🎯': 'target',
    '🗑️': 'trash',
    '🗑': 'trash',
    '🖼️': 'image',
    '🖼': 'image',
    '⬇️': 'download',
    '⬇': 'download',
    '📤': 'upload',
    '◀': 'chevron-left',
    '▶': 'chevron-right',
    '📁': 'folder',
    '📂': 'folder-open',
    '🏦': 'bank',
    '💻': 'laptop',
    '💳': 'credit-card',
    '🏛️': 'bank',
    '🏛': 'bank',
    '❓': 'help-circle',
    '🔑': 'key',
    '👁️': 'eye',
    '👁': 'eye',
    '🧐': 'eye',
    '🙈': 'eye-off',
    '💡': 'bulb',
    '🐍': 'terminal',
    '☁️': 'cloud',
    '☁': 'cloud',
    '🚪': 'logout',
    'ℹ️': 'info',
    'ℹ': 'info',
    '▶️': 'play',
    '⏸️': 'pause',
    '⏸': 'pause',
    '↩️': 'undo',
    '↩': 'undo',
    '🟢': 'dot-green',
    '🔴': 'dot-red',
    '🟡': 'dot-yellow',
    '🟠': 'dot-orange',
    '⚪': 'dot-white',
    '🔹': 'dot-green',
    '⚖️': 'pin',
    '⚖': 'pin',
    '🆔': 'hash'
  };

  function renderIcon(keyOrEmoji, options = {}) {
    const cleanInput = String(keyOrEmoji || '').trim();
    const key = ICON_DEFS[cleanInput]
      ? cleanInput
      : (EMOJI_TO_ICON_KEY[cleanInput] || EMOJI_TO_ICON_KEY[cleanInput.replace(/\uFE0F/g, '')] || 'target');

    const def = ICON_DEFS[key] || ICON_DEFS['target'];
    const color = options.color || def.color || 'currentColor';
    const extraClass = options.className ? ` ${options.className}` : '';
    return `<span class="ui-icon ui-icon-${key}${extraClass}" data-ui-icon="1" style="--icon-color: ${color};"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${def.svg}</svg></span>`;
  }

  function getFilterIconHtml(filter) {
    if (!filter) return renderIcon('bolt');
    const mappedKey = FILTER_ID_ICON_MAP[filter.id];
    if (mappedKey) {
      return renderIcon(mappedKey);
    }
    const rawIcon = String(filter.icon || '🎯').trim();
    const key = EMOJI_TO_ICON_KEY[rawIcon] || EMOJI_TO_ICON_KEY[rawIcon.replace(/\uFE0F/g, '')] || 'target';
    const customColor = filter.isSystem ? undefined : (filter.color || undefined);
    return renderIcon(key, { color: customColor });
  }

  // Regex matching any known emoji token (sorted longest first so multi-codepoint sequences match cleanly)
  const sortedEmojis = Object.keys(EMOJI_TO_ICON_KEY).sort((a, b) => b.length - a.length);
  const escapedEmojis = sortedEmojis.map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const EMOJI_REPLACE_REGEX = new RegExp(`((?:${escapedEmojis.join('|')})\\uFE0F?)`, 'g');

  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'OPTION', 'INPUT', 'SELECT', 'CODE', 'PRE', 'SVG', 'PATH', 'CIRCLE', 'RECT']);

  function shouldSkipNode(node) {
    let curr = node.parentElement;
    while (curr) {
      if (SKIP_TAGS.has(curr.tagName)) return true;
      if (curr.hasAttribute && curr.hasAttribute('data-ui-icon')) return true;
      if (curr.getAttribute && curr.getAttribute('contenteditable') === 'true') return true;
      if (curr.classList && (
        curr.classList.contains('rich-editor-content') ||
        curr.classList.contains('description-box') ||
        curr.classList.contains('comment-content') ||
        curr.classList.contains('app-dialog-message')
      )) {
        return true;
      }
      curr = curr.parentElement;
    }
    return false;
  }

  function upgradeTextNode(textNode) {
    const val = textNode.nodeValue;
    if (!val || !EMOJI_REPLACE_REGEX.test(val)) return;
    EMOJI_REPLACE_REGEX.lastIndex = 0;
    if (shouldSkipNode(textNode)) return;

    const parts = val.split(EMOJI_REPLACE_REGEX);
    if (parts.length <= 1) return;

    const frag = document.createDocumentFragment();
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      if (EMOJI_TO_ICON_KEY[part] || EMOJI_TO_ICON_KEY[part.replace(/\uFE0F/g, '')]) {
        const temp = document.createElement('span');
        temp.innerHTML = renderIcon(part);
        if (temp.firstChild) frag.appendChild(temp.firstChild);
      } else {
        frag.appendChild(document.createTextNode(part));
      }
    }
    if (textNode.parentNode) {
      textNode.parentNode.replaceChild(frag, textNode);
    }
  }

  function upgradeIconsInSubtree(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      upgradeTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE && SKIP_TAGS.has(root.tagName)) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    let current;
    while ((current = walker.nextNode())) {
      if (current.nodeValue && EMOJI_REPLACE_REGEX.test(current.nodeValue)) {
        EMOJI_REPLACE_REGEX.lastIndex = 0;
        textNodes.push(current);
      }
    }
    for (let i = 0; i < textNodes.length; i++) {
      upgradeTextNode(textNodes[i]);
    }
  }

  function initIconObserver() {
    if (!document.body) return;
    upgradeIconsInSubtree(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'characterData') {
          upgradeTextNode(m.target);
        } else if (m.type === 'childList' && m.addedNodes.length > 0) {
          for (let i = 0; i < m.addedNodes.length; i++) {
            upgradeIconsInSubtree(m.addedNodes[i]);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIconObserver);
  } else {
    initIconObserver();
  }

  window.AppIcons = ICON_DEFS;
  window.renderIcon = renderIcon;
  window.getFilterIconHtml = getFilterIconHtml;
  window.upgradeIconsInSubtree = upgradeIconsInSubtree;
})();
