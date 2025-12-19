// 실시간 모니터링

const QuizMonitor = {
  teacherId: null,
  quizId: null,
  quiz: null,
  students: [],
  submissions: [],
  realtimeSubscription: null,
  lastUpdateTime: null,
  
  // 초기화
  async init() {
    const user = Auth.getCurrentUser();
    if (!user || user.role !== 'teacher') {
      return;
    }
    
    this.teacherId = user.id;
    
    // URL에서 quizId 가져오기
    const params = Utils.getQueryParams();
    this.quizId = params.quizId;
    
    if (!this.quizId) {
      Utils.showToast('퀴즈를 선택해주세요.', 'warning');
      window.history.back();
      return;
    }
    
    try {
      await this.loadQuiz();
      await this.loadStudents();
      await this.loadSubmissions();
      this.setupRealtime();
      this.startUpdateTimer();
    } catch (error) {
      console.error('Monitor initialization error:', error);
      Utils.handleError(error, '모니터링 초기화 중 오류가 발생했습니다.');
    }
  },
  
  // 퀴즈 정보 로드
  async loadQuiz() {
    try {
      this.quiz = await DB.quizzes.getById(this.quizId);
      document.getElementById('quiz-title-display').textContent = this.quiz.title;
    } catch (error) {
      console.error('Quiz loading error:', error);
      throw error;
    }
  },
  
  // 학생 목록 로드
  async loadStudents() {
    try {
      this.students = await DB.users.getStudentsByTeacher(this.teacherId);
    } catch (error) {
      console.error('Students loading error:', error);
      throw error;
    }
  },
  
  // 제출 현황 로드
  async loadSubmissions() {
    try {
      this.submissions = await DB.submissions.getByQuiz(this.quizId);
      this.updateUI();
      this.lastUpdateTime = new Date();
    } catch (error) {
      console.error('Submissions loading error:', error);
      throw error;
    }
  },
  
  // 실시간 업데이트 설정
  setupRealtime() {
    this.realtimeSubscription = DB.realtime.subscribeToSubmissions(
      this.quizId,
      async (payload) => {
        console.log('Realtime update:', payload);
        await this.loadSubmissions();
      }
    );
  },
  
  // 마지막 업데이트 시간 표시
  startUpdateTimer() {
    setInterval(() => {
      if (this.lastUpdateTime) {
        document.getElementById('last-update').textContent = Utils.timeAgo(this.lastUpdateTime);
      }
    }, 10000); // 10초마다
  },
  
  // UI 업데이트
  updateUI() {
    this.updateStats();
    this.renderStudentsTable();
  },
  
  // 통계 업데이트
  updateStats() {
    const totalStudents = this.students.length;
    const submitted = this.submissions.filter(s => s.status === 'submitted').length;
    const inProgress = this.submissions.filter(s => s.status === 'in-progress').length;
    const notStarted = totalStudents - this.submissions.length;
    
    document.getElementById('stat-total-students').textContent = totalStudents;
    document.getElementById('stat-submitted').textContent = submitted;
    document.getElementById('stat-in-progress').textContent = inProgress;
    document.getElementById('stat-not-started').textContent = notStarted;
  },
  
  // 학생 테이블 렌더링
  renderStudentsTable() {
    const container = document.getElementById('students-table-container');
    
    let html = `
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>학생</th>
              <th style="text-align: center;">상태</th>
              <th style="text-align: center;">점수</th>
              <th style="text-align: center;">정답률</th>
              <th style="text-align: center;">제출 시간</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    this.students.forEach(student => {
      const submission = this.submissions.find(s => s.student_id === student.id);
      
      let statusBadge, score, percentage, submittedTime;
      
      if (!submission) {
        statusBadge = '<span class="badge badge-gray">미시작</span>';
        score = '-';
        percentage = '-';
        submittedTime = '-';
      } else if (submission.status === 'in-progress') {
        statusBadge = '<span class="badge badge-warning">진행중</span>';
        score = '-';
        percentage = '-';
        submittedTime = Utils.timeAgo(submission.submitted_at);
      } else {
        statusBadge = '<span class="badge badge-success">제출완료</span>';
        score = `${submission.score}/${submission.total_questions}`;
        percentage = Math.round((submission.score / submission.total_questions) * 100);
        submittedTime = Utils.formatDate(submission.submitted_at, 'YYYY-MM-DD HH:mm');
      }
      
      html += `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="avatar avatar-sm">${student.name.charAt(0)}</div>
              <strong>${Utils.escapeHtml(student.name)}</strong>
            </div>
          </td>
          <td style="text-align: center;">${statusBadge}</td>
          <td style="text-align: center;">${score}</td>
          <td style="text-align: center;">
            ${percentage !== '-' ? `
              <span style="font-weight: 600; color: ${percentage >= 70 ? 'var(--success-color)' : percentage >= 40 ? 'var(--warning-color)' : 'var(--error-color)'};">
                ${percentage}%
              </span>
            ` : '-'}
          </td>
          <td style="text-align: center; font-size: 0.875rem; color: var(--text-secondary);">
            ${submittedTime}
          </td>
        </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
      </div>
    `;
    
    container.innerHTML = html;
  },
  
  // 정리
  cleanup() {
    if (this.realtimeSubscription) {
      DB.realtime.unsubscribe(this.realtimeSubscription);
    }
  }
};

// 전역으로 export
window.QuizMonitor = QuizMonitor;

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
  if (window.QuizMonitor) {
    QuizMonitor.cleanup();
  }
});
