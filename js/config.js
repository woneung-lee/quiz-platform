// 환경 설정
const CONFIG = {
  // Supabase 설정 (실제 값으로 교체 필요)
  SUPABASE_URL: 'https://wpmhiibazynjkfkyvcxj.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_AGJ6C--1yTARsg99Y0FQDw_jyKH2tBZ',
  SUPABASE_FUNCTION_URL: 'https://your-project.supabase.co/functions/v1',
  
  // 파일 업로드 설정
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'text/plain'],
  
  // 퀴즈 설정
  DEFAULT_QUESTION_COUNT: 10,
  DEFAULT_CHOICE_COUNT: 4,
  MIN_QUESTION_COUNT: 5,
  MAX_QUESTION_COUNT: 50,
  MIN_CHOICE_COUNT: 2,
  MAX_CHOICE_COUNT: 5,
  
  // UI 설정
  ITEMS_PER_PAGE: 20,
  DEBOUNCE_DELAY: 300,
  
  // 로컬 스토리지 키
  STORAGE_KEYS: {
    USER: 'quiz_platform_user',
    SESSION: 'quiz_platform_session',
    THEME: 'quiz_platform_theme'
  }
};

// 개발 환경에서 사용할 설정
const DEV_CONFIG = {
  DEBUG: true,
  LOG_LEVEL: 'debug'
};

// 프로덕션 환경 설정
const PROD_CONFIG = {
  DEBUG: false,
  LOG_LEVEL: 'error'
};

// 현재 환경에 따라 설정 병합
const ENV = window.location.hostname === 'localhost' ? DEV_CONFIG : PROD_CONFIG;

// 최종 설정 export
window.CONFIG = { ...CONFIG, ...ENV };
