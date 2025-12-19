// 과목 관리 기능

const SubjectsManager = {
  teacherId: null,
  subjects: [],
  currentSubjectId: null,
  
  // 초기화
  async init() {
    const user = Auth.getCurrentUser();
    if (!user || user.role !== 'teacher') {
      return;
    }
    
    this.teacherId = user.id;
    
    await this.loadSubjects();
    this.setupEventListeners();
  },
  
  // 이벤트 리스너 설정
  setupEventListeners() {
    // 과목 추가 버튼
    document.getElementById('add-subject-btn').addEventListener('click', () => {
      this.openSubjectModal();
    });
    
    // 과목 폼 제출
    document.getElementById('subject-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveSubject();
    });
    
    // 과목 삭제 확인
    document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
      await this.deleteSubject();
    });
  },
  
  // 과목 목록 로드
  async loadSubjects() {
    const container = document.getElementById('subjects-grid');
    
    try {
      this.subjects = await DB.subjects.getByTeacher(this.teacherId);
      
      if (this.subjects.length === 0) {
        container.innerHTML = `
          <div style="grid-column: 1 / -1;">
            <div class="empty-state">
              <div class="empty-state-icon">📚</div>
              <p class="empty-state-title">아직 과목이 없습니다</p>
              <p class="empty-state-text">첫 번째 과목을 만들어보세요!</p>
              <button class="btn btn-primary" onclick="SubjectsManager.openSubjectModal()">
                ➕ 과목 추가하기
              </button>
            </div>
          </div>
        `;
        return;
      }
      
      let html = '';
      
      for (const subject of this.subjects) {
        // 퀴즈 개수 가져오기
        const quizzes = await DB.quizzes.getBySubject(subject.id);
        const activeQuizzes = quizzes.filter(q => q.status === 'active').length;
        
        const colorDark = this.darkenColor(subject.color || '#4F46E5', 20);
        
        html += `
          <div class="subject-card" 
               style="--subject-color: ${subject.color || '#4F46E5'}; --subject-color-dark: ${colorDark};">
            <div class="subject-card-menu">
              <div class="dropdown">
                <button class="subject-card-menu-btn dropdown-toggle" onclick="event.stopPropagation();">⋮</button>
                <div class="dropdown-menu">
                  <button class="dropdown-item" onclick="SubjectsManager.openSubjectModal('${subject.id}')">
                    ✏️ 수정
                  </button>
                  <div class="dropdown-divider"></div>
                  <button class="dropdown-item" onclick="SubjectsManager.confirmDelete('${subject.id}', '${Utils.escapeHtml(subject.name)}')">
                    🗑️ 삭제
                  </button>
                </div>
              </div>
            </div>
            
            <div class="subject-card-icon">${subject.icon || '📚'}</div>
            <div class="subject-card-name">${Utils.escapeHtml(subject.name)}</div>
            <div class="subject-card-stats">
              <span>📝 ${quizzes.length}개 퀴즈</span>
              ${activeQuizzes > 0 ? `<span>✅ ${activeQuizzes}개 진행중</span>` : ''}
            </div>
            
            <div class="subject-card-actions">
              <button class="subject-card-btn" onclick="SubjectsManager.viewQuizzes('${subject.id}')">
                퀴즈 보기
              </button>
              <button class="subject-card-btn" onclick="SubjectsManager.createQuiz('${subject.id}')">
                ➕ 퀴즈 생성
              </button>
            </div>
          </div>
        `;
      }
      
      container.innerHTML = html;
      
      // 드롭다운 이벤트 설정
      this.setupDropdowns();
      
    } catch (error) {
      console.error('Subjects loading error:', error);
      container.innerHTML = `
        <div style="grid-column: 1 / -1;">
          <div class="alert alert-error">
            과목 목록을 불러오는 중 오류가 발생했습니다.
          </div>
        </div>
      `;
    }
  },
  
  // 드롭다운 설정
  setupDropdowns() {
    document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = toggle.closest('.dropdown');
        const isActive = dropdown.classList.contains('active');
        
        // 다른 드롭다운 닫기
        document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('active'));
        
        if (!isActive) {
          dropdown.classList.add('active');
        }
      });
    });
    
    // 외부 클릭 시 모든 드롭다운 닫기
    document.addEventListener('click', () => {
      document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('active'));
    });
  },
  
  // 과목 모달 열기
  openSubjectModal(subjectId = null) {
    this.currentSubjectId = subjectId;
    
    if (subjectId) {
      // 수정 모드
      const subject = this.subjects.find(s => s.id === subjectId);
      if (subject) {
        const titleEl = document.getElementById('subject-modal-title');
        if (titleEl) titleEl.textContent = '과목 수정';
        
        document.getElementById('subject-id').value = subject.id;
        document.getElementById('subject-name').value = subject.name;
        document.getElementById('subject-icon').value = subject.icon || '📚';
        document.getElementById('subject-color').value = subject.color || '#3B82F6';
        
        // 이모지 버튼 선택
        document.querySelectorAll('.emoji-option').forEach(btn => {
          btn.classList.toggle('selected', btn.dataset.emoji === subject.icon);
        });
      }
    } else {
      // 추가 모드
      const titleEl = document.getElementById('subject-modal-title');
      if (titleEl) titleEl.textContent = '새 과목 추가';
      
      document.getElementById('subject-form').reset();
      document.getElementById('subject-id').value = '';
      document.getElementById('subject-icon').value = '📚';
      document.getElementById('subject-color').value = '#3B82F6';
      
      // 첫 번째 이모지 선택
      document.querySelectorAll('.emoji-option').forEach(btn => btn.classList.remove('selected'));
      const firstEmoji = document.querySelector('.emoji-option');
      if (firstEmoji) firstEmoji.classList.add('selected');
    }
    
    Utils.modal.show('subject-modal');
  },
  
  // 과목 저장
  async saveSubject() {
    const submitBtn = document.getElementById('subject-submit-btn');
    
    try {
      Utils.toggleLoading(submitBtn, true);
      
      const subjectId = document.getElementById('subject-id').value;
      const data = {
        name: document.getElementById('subject-name').value.trim(),
        icon: document.getElementById('subject-icon').value.trim() || '📚',
        color: document.getElementById('subject-color').value,
        teacher_id: this.teacherId
      };
      
      if (subjectId) {
        // 수정
        await DB.subjects.update(subjectId, data);
        Utils.showToast('과목이 수정되었습니다.', 'success');
      } else {
        // 추가
        const maxOrder = Math.max(...this.subjects.map(s => s.order_num || 0), 0);
        data.order_num = maxOrder + 1;
        await DB.subjects.create(data);
        Utils.showToast('과목이 추가되었습니다.', 'success');
      }
      
      Utils.modal.hide('subject-modal');
      await this.loadSubjects();
      
    } catch (error) {
      console.error('Subject save error:', error);
      Utils.handleError(error, '과목 저장 중 오류가 발생했습니다.');
    } finally {
      Utils.toggleLoading(submitBtn, false);
    }
  },
  
  // 삭제 확인 모달
  confirmDelete(subjectId, subjectName) {
    document.getElementById('delete-subject-id').value = subjectId;
    document.getElementById('delete-subject-name').textContent = subjectName;
    Utils.modal.show('delete-subject-modal');
  },
  
  // 과목 삭제
  async deleteSubject() {
    const subjectId = document.getElementById('delete-subject-id').value;
    const confirmBtn = document.getElementById('confirm-delete-btn');
    
    try {
      Utils.toggleLoading(confirmBtn, true);
      
      await DB.subjects.delete(subjectId);
      
      Utils.showToast('과목이 삭제되었습니다.', 'success');
      Utils.modal.hide('delete-subject-modal');
      
      await this.loadSubjects();
      
    } catch (error) {
      console.error('Subject delete error:', error);
      Utils.handleError(error, '과목 삭제 중 오류가 발생했습니다.');
    } finally {
      Utils.toggleLoading(confirmBtn, false);
    }
  },
  
  // 퀴즈 목록 보기
  viewQuizzes(subjectId) {
    window.location.href = `/teacher/quiz-list.html?subjectId=${subjectId}`;
  },
  
  // 퀴즈 생성
  createQuiz(subjectId) {
    window.location.href = `/teacher/create-quiz.html?subjectId=${subjectId}`;
  },
  
  // 색상 어둡게 하기
  darkenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return '#' + (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
  }
};

// 전역으로 export
window.SubjectsManager = SubjectsManager;
