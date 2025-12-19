// 학생 - 과목별 퀴즈 목록

const StudentSubjects = {
  studentId: null,
  subjectId: null,
  subject: null,
  quizzes: [],
  submissions: [],
  
  // 초기화
  async init() {
    const user = Auth.getCurrentUser();
    if (!user || user.role !== 'student') {
      return;
    }
    
    this.studentId = user.id;
    
    // URL에서 subjectId 가져오기
    const params = Utils.getQueryParams();
    this.subjectId = params.subjectId;
    
    if (!this.subjectId) {
      Utils.showToast('과목을 선택해주세요.', 'warning');
      window.location.href = '/student/dashboard.html';
      return;
    }
    
    try {
      await this.loadSubject();
      await this.loadQuizzes();
      await this.loadSubmissions();
      this.renderQuizzes();
    } catch (error) {
      console.error('Subject quizzes initialization error:', error);
      Utils.handleError(error, '퀴즈 목록 로딩 중 오류가 발생했습니다.');
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
    } catch (error) {
      console.error('Quizzes loading error:', error);
      throw error;
    }
  },
  
  // 내 제출 기록 로드
  async loadSubmissions() {
    try {
      this.submissions = await DB.submissions.getByStudent(this.studentId);
    } catch (error) {
      console.error('Submissions loading error:', error);
      throw error;
    }
  },
  
  // 퀴즈 목록 렌더링
  renderQuizzes() {
    // 진행 가능한 퀴즈
    const availableQuizzes = this.quizzes.filter(q => {
      if (q.status !== 'active') return false;
      const mySubmission = this.submissions.find(s => 
        s.quiz_id === q.id && s.status === 'submitted'
      );
      return !mySubmission;
    });
    
    // 복습 가능한 퀴즈
    const reviewQuizzes = this.quizzes.filter(q => {
      const mySubmission = this.submissions.find(s => 
        s.quiz_id === q.id && s.status === 'submitted'
      );
      return mySubmission;
    });
    
    // 카운트 업데이트
    document.getElementById('available-count').textContent = availableQuizzes.length;
    document.getElementById('review-count').textContent = reviewQuizzes.length;
    
    // 렌더링
    this.renderAvailableQuizzes(availableQuizzes);
    this.renderReviewQuizzes(reviewQuizzes);
  },
  
  // 진행 가능한 퀴즈 렌더링
  renderAvailableQuizzes(quizzes) {
    const container = document.getElementById('available-quizzes-container');
    
    if (quizzes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <p class="empty-state-title">진행 가능한 퀴즈가 없습니다</p>
          <p class="empty-state-text">선생님이 새로운 퀴즈를 내면 여기에 표시됩니다.</p>
        </div>
      `;
      return;
    }
    
    // 최신순 정렬
    quizzes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    let html = '';
    
    quizzes.forEach(quiz => {
      html += `
        <div class="quiz-card" onclick="window.location.href='/student/quiz.html?quizId=${quiz.id}'">
          <div class="quiz-card-header">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                <span class="badge badge-success">진행중</span>
                ${quiz.has_file ? '<span class="badge badge-primary">📎 파일</span>' : ''}
              </div>
              <h3 class="quiz-card-title">${Utils.escapeHtml(quiz.title)}</h3>
              <div class="quiz-card-meta">
                <span>📝 ${quiz.question_count}개 문제</span>
                <span>✅ ${quiz.choice_count}지선다</span>
              </div>
            </div>
          </div>
          
          <div class="quiz-card-status">
            <div style="font-size: 1.5rem;">🎯</div>
            <div style="flex: 1;">
              <div style="font-weight: 600; margin-bottom: 0.25rem;">시작하기</div>
              <div style="font-size: 0.875rem; color: var(--text-secondary);">
                퀴즈를 풀고 점수를 확인하세요
              </div>
            </div>
            <div>
              <button class="btn btn-primary">시작 →</button>
            </div>
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
  },
  
  // 복습 가능한 퀴즈 렌더링
  renderReviewQuizzes(quizzes) {
    const container = document.getElementById('review-quizzes-container');
    
    if (quizzes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✅</div>
          <p class="empty-state-title">복습할 퀴즈가 없습니다</p>
          <p class="empty-state-text">퀴즈를 완료하면 여기서 복습할 수 있습니다.</p>
        </div>
      `;
      return;
    }
    
    // 최신 제출 순으로 정렬
    const quizzesWithSubmission = quizzes.map(quiz => {
      const submission = this.submissions.find(s => 
        s.quiz_id === quiz.id && s.status === 'submitted'
      );
      return { quiz, submission };
    }).filter(item => item.submission);
    
    quizzesWithSubmission.sort((a, b) => 
      new Date(b.submission.submitted_at) - new Date(a.submission.submitted_at)
    );
    
    let html = '';
    
    quizzesWithSubmission.forEach(({ quiz, submission }) => {
      const percentage = Math.round((submission.score / submission.total_questions) * 100);
      
      html += `
        <div class="quiz-card" onclick="window.location.href='/student/review.html?quizId=${quiz.id}'">
          <div class="quiz-card-header">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                <span class="badge badge-info">완료</span>
                ${quiz.has_file ? '<span class="badge badge-primary">📎 파일</span>' : ''}
              </div>
              <h3 class="quiz-card-title">${Utils.escapeHtml(quiz.title)}</h3>
              <div class="quiz-card-meta">
                <span>📝 ${quiz.question_count}개 문제</span>
                <span>📅 ${Utils.formatDate(submission.submitted_at, 'YYYY-MM-DD')}</span>
              </div>
            </div>
          </div>
          
          <div class="quiz-card-status">
            <div style="font-size: 1.5rem;">
              ${percentage >= 70 ? '🎉' : percentage >= 40 ? '😊' : '😢'}
            </div>
            <div style="flex: 1;">
              <div style="font-weight: 600; margin-bottom: 0.25rem;">
                ${submission.score}/${submission.total_questions}점 (${percentage}%)
              </div>
              <div style="font-size: 0.875rem; color: var(--text-secondary);">
                복습하여 틀린 문제를 확인하세요
              </div>
            </div>
            <div>
              <button class="btn btn-outline">복습하기</button>
            </div>
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
  }
};

// 전역으로 export
window.StudentSubjects = StudentSubjects;
