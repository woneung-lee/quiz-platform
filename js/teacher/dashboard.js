// 선생님 대시보드 기능

const TeacherDashboard = {
  teacherId: null,
  
  // 초기화
  async init() {
    const user = Auth.getCurrentUser();
    if (!user || user.role !== 'teacher') {
      return;
    }
    
    this.teacherId = user.id;
    
    try {
      await Promise.all([
        this.loadStatistics(),
        this.loadActiveQuizzes(),
        this.loadRecentSubmissions()
      ]);
    } catch (error) {
      console.error('Dashboard initialization error:', error);
      Utils.handleError(error, '대시보드 로딩 중 오류가 발생했습니다.');
    }
  },
  
  // 통계 로드
  async loadStatistics() {
    try {
      // 과목 수
      const subjects = await DB.subjects.getByTeacher(this.teacherId);
      document.getElementById('stat-subjects').textContent = subjects.length;
      
      // 학생 수
      const students = await DB.users.getStudentsByTeacher(this.teacherId);
      document.getElementById('stat-students').textContent = students.length;
      
      // 퀴즈 수
      const quizzes = await DB.quizzes.getByTeacher(this.teacherId);
      document.getElementById('stat-quizzes').textContent = quizzes.length;
      
      // 제출된 답안 수 (모든 퀴즈에 대한)
      let totalSubmissions = 0;
      for (const quiz of quizzes) {
        const submissions = await DB.submissions.getByQuiz(quiz.id);
        totalSubmissions += submissions.filter(s => s.status === 'submitted').length;
      }
      document.getElementById('stat-submissions').textContent = totalSubmissions;
      
    } catch (error) {
      console.error('Statistics loading error:', error);
      throw error;
    }
  },
  
  // 진행 중인 퀴즈 로드
  async loadActiveQuizzes() {
    const container = document.getElementById('active-quizzes-list');
    
    try {
      const quizzes = await DB.quizzes.getByTeacher(this.teacherId);
      const activeQuizzes = quizzes.filter(q => q.status === 'active').slice(0, 5);
      
      if (activeQuizzes.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="padding: 2rem;">
            <div class="empty-state-icon">📝</div>
            <p class="empty-state-title">진행 중인 퀴즈가 없습니다</p>
            <p class="empty-state-text">새로운 퀴즈를 생성해보세요!</p>
            <a href="/teacher/subjects.html" class="btn btn-primary">퀴즈 만들기</a>
          </div>
        `;
        return;
      }
      
      let html = '<div style="display: flex; flex-direction: column; gap: 1rem;">';
      
      for (const quiz of activeQuizzes) {
        // 제출 현황 가져오기
        const submissions = await DB.submissions.getByQuiz(quiz.id);
        const submittedCount = submissions.filter(s => s.status === 'submitted').length;
        const totalStudents = await DB.users.getStudentsByTeacher(this.teacherId);
        
        // 과목 정보 가져오기
        const subject = await DB.subjects.getById(quiz.subject_id);
        
        html += `
          <div style="padding: 1rem; border: 1px solid var(--border-color); border-radius: var(--border-radius); display: flex; justify-content: space-between; align-items: center;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                <span class="badge badge-primary">${subject.name}</span>
                <span class="badge badge-success">진행중</span>
              </div>
              <h4 style="margin: 0 0 0.5rem 0;">${Utils.escapeHtml(quiz.title)}</h4>
              <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">
                ${quiz.question_count}개 문제 • ${submittedCount}/${totalStudents.length}명 제출
              </p>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <a href="/teacher/monitor.html?quizId=${quiz.id}" class="btn btn-sm btn-primary">모니터링</a>
              <a href="/teacher/analytics.html?quizId=${quiz.id}" class="btn btn-sm btn-outline">결과보기</a>
            </div>
          </div>
        `;
      }
      
      html += '</div>';
      container.innerHTML = html;
      
    } catch (error) {
      console.error('Active quizzes loading error:', error);
      container.innerHTML = `
        <div class="alert alert-error">
          퀴즈 목록을 불러오는 중 오류가 발생했습니다.
        </div>
      `;
    }
  },
  
  // 최근 학생 활동 로드
  async loadRecentSubmissions() {
    const container = document.getElementById('recent-submissions-list');
    
    try {
      // 모든 퀴즈의 최근 제출 가져오기
      const quizzes = await DB.quizzes.getByTeacher(this.teacherId);
      let allSubmissions = [];
      
      for (const quiz of quizzes) {
        const submissions = await DB.submissions.getByQuiz(quiz.id);
        allSubmissions = allSubmissions.concat(
          submissions.map(s => ({ ...s, quizTitle: quiz.title }))
        );
      }
      
      // 최근 순으로 정렬
      allSubmissions.sort((a, b) => 
        new Date(b.submitted_at) - new Date(a.submitted_at)
      );
      
      const recentSubmissions = allSubmissions.slice(0, 5);
      
      if (recentSubmissions.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="padding: 2rem;">
            <div class="empty-state-icon">📊</div>
            <p class="empty-state-title">아직 제출된 답안이 없습니다</p>
            <p class="empty-state-text">학생들이 퀴즈를 풀면 여기에 표시됩니다.</p>
          </div>
        `;
        return;
      }
      
      let html = '<div style="display: flex; flex-direction: column; gap: 1rem;">';
      
      for (const submission of recentSubmissions) {
        const percentage = Math.round((submission.score / submission.total_questions) * 100);
        const statusBadge = submission.status === 'submitted' 
          ? '<span class="badge badge-success">제출완료</span>'
          : '<span class="badge badge-warning">진행중</span>';
        
        html += `
          <div style="padding: 1rem; border: 1px solid var(--border-color); border-radius: var(--border-radius);">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
              <div>
                <h4 style="margin: 0 0 0.25rem 0;">${Utils.escapeHtml(submission.users.name)}</h4>
                <p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary);">
                  ${Utils.escapeHtml(submission.quizTitle)}
                </p>
              </div>
              ${statusBadge}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 0.875rem; color: var(--text-secondary);">
                ${Utils.timeAgo(submission.submitted_at)}
              </div>
              ${submission.status === 'submitted' ? `
                <div style="font-weight: 600; color: ${percentage >= 70 ? 'var(--success-color)' : percentage >= 40 ? 'var(--warning-color)' : 'var(--error-color)'};">
                  ${submission.score}/${submission.total_questions} (${percentage}%)
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }
      
      html += '</div>';
      container.innerHTML = html;
      
    } catch (error) {
      console.error('Recent submissions loading error:', error);
      container.innerHTML = `
        <div class="alert alert-error">
          최근 활동을 불러오는 중 오류가 발생했습니다.
        </div>
      `;
    }
  }
};

// 전역으로 export
window.TeacherDashboard = TeacherDashboard;
