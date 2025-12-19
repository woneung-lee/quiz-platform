// 학생 대시보드

const StudentDashboard = {
  studentId: null,
  teacherId: null,
  subjects: [],
  submissions: [],
  
  // 초기화
  async init() {
    const user = Auth.getCurrentUser();
    if (!user || user.role !== 'student') {
      return;
    }
    
    this.studentId = user.id;
    this.teacherId = user.teacher_id;
    
    try {
      await this.loadData();
    } catch (error) {
      console.error('Student dashboard initialization error:', error);
      Utils.handleError(error, '대시보드 로딩 중 오류가 발생했습니다.');
    }
  },
  
  // 데이터 로드
  async loadData() {
    try {
      // 과목 목록
      this.subjects = await DB.subjects.getByTeacher(this.teacherId);
      
      // 내 제출 기록
      this.submissions = await DB.submissions.getByStudent(this.studentId);
      
      // UI 업데이트
      await this.updateStats();
      await this.renderSubjects();
      
    } catch (error) {
      console.error('Data loading error:', error);
      throw error;
    }
  },
  
  // 통계 업데이트
  async updateStats() {
    // 완료한 퀴즈 수
    const completedCount = this.submissions.filter(s => s.status === 'submitted').length;
    document.getElementById('stat-completed').textContent = completedCount;
    
    // 평균 점수
    const completedSubmissions = this.submissions.filter(s => s.status === 'submitted');
    let avgScore = 0;
    if (completedSubmissions.length > 0) {
      const totalPercentage = completedSubmissions.reduce((sum, s) => 
        sum + (s.score / s.total_questions * 100), 0
      );
      avgScore = Math.round(totalPercentage / completedSubmissions.length);
    }
    document.getElementById('stat-average').textContent = `${avgScore}%`;
    
    // 진행 가능한 퀴즈 수 (active 상태이고 아직 제출 안한 것)
    let availableCount = 0;
    for (const subject of this.subjects) {
      const quizzes = await DB.quizzes.getBySubject(subject.id);
      const activeQuizzes = quizzes.filter(q => q.status === 'active');
      
      for (const quiz of activeQuizzes) {
        const mySubmission = this.submissions.find(s => 
          s.quiz_id === quiz.id && s.status === 'submitted'
        );
        if (!mySubmission) {
          availableCount++;
        }
      }
    }
    document.getElementById('stat-available').textContent = availableCount;
  },
  
  // 과목 카드 렌더링
  async renderSubjects() {
    const container = document.getElementById('subjects-grid');
    
    if (this.subjects.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1;">
          <div class="empty-state">
            <div class="empty-state-icon">📚</div>
            <p class="empty-state-title">아직 과목이 없습니다</p>
            <p class="empty-state-text">선생님이 과목을 만들면 여기에 표시됩니다.</p>
          </div>
        </div>
      `;
      return;
    }
    
    let html = '';
    
    for (const subject of this.subjects) {
      // 과목별 퀴즈 가져오기
      const quizzes = await DB.quizzes.getBySubject(subject.id);
      
      // 진행 가능한 퀴즈 (active 상태이고 아직 안 푼 것)
      let availableQuizzes = 0;
      for (const quiz of quizzes.filter(q => q.status === 'active')) {
        const mySubmission = this.submissions.find(s => 
          s.quiz_id === quiz.id && s.status === 'submitted'
        );
        if (!mySubmission) {
          availableQuizzes++;
        }
      }
      
      // 복습 가능한 퀴즈 (완료한 것)
      const completedQuizzes = this.submissions.filter(s => 
        s.status === 'submitted' && 
        quizzes.some(q => q.id === s.quiz_id)
      ).length;
      
      const colorDark = this.darkenColor(subject.color || '#4F46E5', 20);
      
      html += `
        <a href="/student/subjects.html?subjectId=${subject.id}" 
           class="subject-card" 
           style="--subject-color: ${subject.color || '#4F46E5'}; --subject-color-dark: ${colorDark};">
          ${availableQuizzes > 0 ? `
            <div class="subject-card-badge">
              ${availableQuizzes}개 대기중
            </div>
          ` : ''}
          
          <div class="subject-card-icon">${subject.icon || '📚'}</div>
          <div class="subject-card-name">${Utils.escapeHtml(subject.name)}</div>
          <div class="subject-card-stats">
            ${availableQuizzes > 0 ? `<span>📝 ${availableQuizzes}개 풀기</span>` : ''}
            ${completedQuizzes > 0 ? `<span>✅ ${completedQuizzes}개 완료</span>` : ''}
          </div>
        </a>
      `;
    }
    
    container.innerHTML = html;
  },
  
  // 색상 어둡게
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
window.StudentDashboard = StudentDashboard;
