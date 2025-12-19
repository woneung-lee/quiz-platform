// 퀴즈 목록 관리

const QuizListManager = {
  teacherId: null,
  subjectId: null,
  subject: null,
  quizzes: [],
  currentFilter: 'all',
  
  // 초기화
  async init() {
    const user = Auth.getCurrentUser();
    if (!user || user.role !== 'teacher') {
      return;
    }
    
    this.teacherId = user.id;
    
    // URL에서 subjectId 가져오기
    const params = Utils.getQueryParams();
    this.subjectId = params.subjectId;
    
    if (!this.subjectId) {
      Utils.showToast('과목을 선택해주세요.', 'warning');
      window.location.href = '/teacher/subjects.html';
      return;
    }
    
    try {
      await this.loadSubject();
      await this.loadQuizzes();
      this.setupEventListeners();
    } catch (error) {
      console.error('Quiz list initialization error:', error);
      Utils.handleError(error, '퀴즈 목록 초기화 중 오류가 발생했습니다.');
    }
  },
  
  // 과목 정보 로드
  async loadSubject() {
    try {
      this.subject = await DB.subjects.getById(this.subjectId);
      
      // 과목 정보 표시
      document.getElementById('subject-name-display').textContent = this.subject.name;
      const iconDisplay = document.getElementById('subject-icon-display');
      iconDisplay.textContent = this.subject.icon || '📚';
      iconDisplay.style.backgroundColor = this.subject.color || '#4F46E5';
      iconDisplay.style.color = 'white';
      
    } catch (error) {
      console.error('Subject loading error:', error);
      throw error;
    }
  },
  
  // 퀴즈 목록 로드
  async loadQuizzes() {
    try {
      this.quizzes = await DB.quizzes.getBySubject(this.subjectId);
      
      // 각 탭에 렌더링
      await this.renderQuizzes('all');
      await this.renderQuizzes('draft');
      await this.renderQuizzes('active');
      await this.renderQuizzes('completed');
      
    } catch (error) {
      console.error('Quizzes loading error:', error);
      throw error;
    }
  },
  
  // 퀴즈 렌더링
  async renderQuizzes(filter = 'all') {
    const containerId = filter === 'all' ? 'quizzes-container' : `${filter}-quizzes-container`;
    const container = document.getElementById(containerId);
    
    if (!container) return;
    
    // 필터링
    let filteredQuizzes = this.quizzes;
    if (filter !== 'all') {
      filteredQuizzes = this.quizzes.filter(q => q.status === filter);
    }
    
    // 최신순 정렬
    filteredQuizzes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    if (filteredQuizzes.length === 0) {
      const filterName = {
        'all': '퀴즈',
        'draft': '비공개 퀴즈',
        'active': '진행중인 퀴즈',
        'completed': '완료된 퀴즈'
      }[filter];
      
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <p class="empty-state-title">${filterName}가 없습니다</p>
          <p class="empty-state-text">새로운 퀴즈를 생성해보세요!</p>
          <button class="btn btn-primary" onclick="window.location.href='/teacher/create-quiz.html?subjectId=${this.subjectId}'">
            ➕ 퀴즈 생성하기
          </button>
        </div>
      `;
      return;
    }
    
    let html = '';
    
    for (const quiz of filteredQuizzes) {
      // 제출 통계
      const submissions = await DB.submissions.getByQuiz(quiz.id);
      const submittedCount = submissions.filter(s => s.status === 'submitted').length;
      const totalStudents = await DB.users.getStudentsByTeacher(this.teacherId);
      
      // 평균 점수
      let avgScore = 0;
      const submittedSubmissions = submissions.filter(s => s.status === 'submitted');
      if (submittedSubmissions.length > 0) {
        const totalPercentage = submittedSubmissions.reduce((sum, s) => 
          sum + (s.score / s.total_questions * 100), 0
        );
        avgScore = Math.round(totalPercentage / submittedSubmissions.length);
      }
      
      // 상태 배지
      const statusBadge = {
        'draft': '<span class="badge badge-gray">비공개</span>',
        'active': '<span class="badge badge-success">진행중</span>',
        'completed': '<span class="badge badge-info">완료</span>'
      }[quiz.status];
      
      html += `
        <div class="quiz-card">
          <div class="quiz-card-header">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                ${statusBadge}
                ${quiz.has_file ? '<span class="badge badge-primary">📎 파일</span>' : ''}
              </div>
              <h3 class="quiz-card-title">${Utils.escapeHtml(quiz.title)}</h3>
              <div class="quiz-card-meta">
                <span>📝 ${quiz.question_count}개 문제</span>
                <span>✅ ${quiz.choice_count}지선다</span>
                <span>🗓️ ${Utils.formatDate(quiz.created_at, 'YYYY-MM-DD')}</span>
              </div>
            </div>
          </div>
          
          ${quiz.status !== 'draft' ? `
            <div class="quiz-card-stats">
              <div class="quiz-stat">
                <div class="quiz-stat-value">${submittedCount}/${totalStudents.length}</div>
                <div class="quiz-stat-label">제출</div>
              </div>
              ${submittedCount > 0 ? `
                <div class="quiz-stat">
                  <div class="quiz-stat-value" style="color: ${avgScore >= 70 ? 'var(--success-color)' : avgScore >= 40 ? 'var(--warning-color)' : 'var(--error-color)'};">
                    ${avgScore}%
                  </div>
                  <div class="quiz-stat-label">평균 점수</div>
                </div>
              ` : ''}
              <div class="quiz-stat">
                <div class="quiz-stat-value">${submissions.filter(s => s.status === 'in-progress').length}</div>
                <div class="quiz-stat-label">진행중</div>
              </div>
            </div>
          ` : ''}
          
          <div class="quiz-card-actions">
            ${quiz.status === 'active' ? `
              <button class="btn btn-primary" onclick="QuizListManager.viewMonitor('${quiz.id}')">
                📊 실시간 모니터링
              </button>
            ` : ''}
            
            ${quiz.status !== 'draft' ? `
              <button class="btn btn-outline" onclick="QuizListManager.viewAnalytics('${quiz.id}')">
                📈 결과 분석
              </button>
            ` : ''}
            
            <button class="btn btn-outline" onclick="QuizListManager.changeStatus('${quiz.id}', '${Utils.escapeHtml(quiz.title)}', '${quiz.status}')">
              🔄 상태 변경
            </button>
            
            <button class="btn btn-secondary" onclick="QuizListManager.confirmDelete('${quiz.id}', '${Utils.escapeHtml(quiz.title)}')">
              🗑️ 삭제
            </button>
          </div>
        </div>
      `;
    }
    
    container.innerHTML = html;
  },
  
  // 이벤트 리스너 설정
  setupEventListeners() {
    // 상태 변경 확인
    document.getElementById('confirm-change-status-btn').addEventListener('click', async () => {
      await this.updateQuizStatus();
    });
    
    // 퀴즈 삭제 확인
    document.getElementById('confirm-delete-quiz-btn').addEventListener('click', async () => {
      await this.deleteQuiz();
    });
  },
  
  // 상태별 필터링
  async filterQuizzesByStatus(status) {
    this.currentFilter = status;
    await this.renderQuizzes(status);
  },
  
  // 실시간 모니터링 페이지로 이동
  viewMonitor(quizId) {
    window.location.href = `/teacher/monitor.html?quizId=${quizId}`;
  },
  
  // 결과 분석 페이지로 이동
  viewAnalytics(quizId) {
    window.location.href = `/teacher/analytics.html?quizId=${quizId}`;
  },
  
  // 상태 변경 모달 열기
  changeStatus(quizId, quizTitle, currentStatus) {
    document.getElementById('status-quiz-id').value = quizId;
    document.getElementById('status-quiz-title').textContent = quizTitle;
    document.getElementById('status-select').value = currentStatus;
    
    Utils.modal.show('change-status-modal');
  },
  
  // 퀴즈 상태 업데이트
  async updateQuizStatus() {
    const confirmBtn = document.getElementById('confirm-change-status-btn');
    
    try {
      Utils.toggleLoading(confirmBtn, true);
      
      const quizId = document.getElementById('status-quiz-id').value;
      const newStatus = document.getElementById('status-select').value;
      
      await DB.quizzes.update(quizId, { status: newStatus });
      
      Utils.showToast('퀴즈 상태가 변경되었습니다.', 'success');
      Utils.modal.hide('change-status-modal');
      
      await this.loadQuizzes();
      
    } catch (error) {
      console.error('Quiz status update error:', error);
      Utils.handleError(error, '상태 변경 중 오류가 발생했습니다.');
    } finally {
      Utils.toggleLoading(confirmBtn, false);
    }
  },
  
  // 삭제 확인 모달
  confirmDelete(quizId, quizTitle) {
    document.getElementById('delete-quiz-id').value = quizId;
    document.getElementById('delete-quiz-title').textContent = quizTitle;
    Utils.modal.show('delete-quiz-modal');
  },
  
  // 퀴즈 삭제
  async deleteQuiz() {
    const confirmBtn = document.getElementById('confirm-delete-quiz-btn');
    
    try {
      Utils.toggleLoading(confirmBtn, true);
      
      const quizId = document.getElementById('delete-quiz-id').value;
      
      await DB.quizzes.delete(quizId);
      
      Utils.showToast('퀴즈가 삭제되었습니다.', 'success');
      Utils.modal.hide('delete-quiz-modal');
      
      await this.loadQuizzes();
      
    } catch (error) {
      console.error('Quiz delete error:', error);
      Utils.handleError(error, '퀴즈 삭제 중 오류가 발생했습니다.');
    } finally {
      Utils.toggleLoading(confirmBtn, false);
    }
  }
};

// 전역으로 export
window.QuizListManager = QuizListManager;
