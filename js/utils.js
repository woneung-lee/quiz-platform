// 유틸리티 함수 모음

const Utils = {
  // 날짜 포맷팅
  formatDate(date, format = 'YYYY-MM-DD HH:mm') {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  },

  // 상대 시간 표시 (예: 2시간 전)
  timeAgo(date) {
    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now - past) / 1000);

    if (diffInSeconds < 60) return '방금 전';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}일 전`;
    
    return this.formatDate(date, 'YYYY-MM-DD');
  },

  // 점수 계산
  calculateScore(answers, correctAnswers) {
    let correct = 0;
    answers.forEach((answer, index) => {
      if (answer === correctAnswers[index]) correct++;
    });
    return {
      score: correct,
      total: correctAnswers.length,
      percentage: Math.round((correct / correctAnswers.length) * 100)
    };
  },

  // 디바운스
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // 배열 섞기 (Fisher-Yates shuffle)
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },

  // HTML 이스케이프 (XSS 방지)
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // 파일 크기 포맷팅
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  },

  // 파일 확장자 추출
  getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2).toLowerCase();
  },

  // 로컬 스토리지 관리
  storage: {
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        console.error('localStorage set error:', error);
        return false;
      }
    },
    
    get(key) {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      } catch (error) {
        console.error('localStorage get error:', error);
        return null;
      }
    },
    
    remove(key) {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.error('localStorage remove error:', error);
        return false;
      }
    },
    
    clear() {
      try {
        localStorage.clear();
        return true;
      } catch (error) {
        console.error('localStorage clear error:', error);
        return false;
      }
    }
  },

  // URL 쿼리 파라미터 파싱
  getQueryParams() {
    const params = {};
    const searchParams = new URLSearchParams(window.location.search);
    for (const [key, value] of searchParams) {
      params[key] = value;
    }
    return params;
  },

  // 쿼리 파라미터 업데이트
  updateQueryParams(params) {
    const url = new URL(window.location);
    Object.keys(params).forEach(key => {
      if (params[key] !== null && params[key] !== undefined) {
        url.searchParams.set(key, params[key]);
      } else {
        url.searchParams.delete(key);
      }
    });
    window.history.pushState({}, '', url);
  },

  // 에러 핸들링
  handleError(error, userMessage = '오류가 발생했습니다.') {
    console.error('Error:', error);
    
    if (window.CONFIG.DEBUG) {
      alert(`${userMessage}\n\n개발자 모드: ${error.message}`);
    } else {
      alert(userMessage);
    }
  },

  // 로딩 상태 토글
  toggleLoading(element, isLoading) {
    if (isLoading) {
      element.disabled = true;
      element.classList.add('loading');
      const originalText = element.textContent;
      element.dataset.originalText = originalText;
      element.textContent = '처리 중...';
    } else {
      element.disabled = false;
      element.classList.remove('loading');
      element.textContent = element.dataset.originalText || element.textContent;
    }
  },

  // 모달 제어
  modal: {
    show(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
      }
    },
    
    hide(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
      }
    },
    
    hideAll() {
      document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
      });
      document.body.style.overflow = '';
    }
  },

  // 토스트 알림
  showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // 애니메이션
    setTimeout(() => toast.classList.add('show'), 10);
    
    // 자동 제거
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // 확인 다이얼로그
  async confirm(message) {
    return new Promise((resolve) => {
      const result = window.confirm(message);
      resolve(result);
    });
  },

  // 배열을 청크로 나누기
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  },

  // 객체 깊은 복사
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  // 랜덤 ID 생성
  generateId(length = 8) {
    return Math.random().toString(36).substring(2, length + 2);
  },

  // 텍스트 축약
  truncate(text, maxLength, suffix = '...') {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
  }
};

// 전역으로 export
window.Utils = Utils;
