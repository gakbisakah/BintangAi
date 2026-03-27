import { BrowserRouter, Routes, Route } from 'react-router-dom'
import InactivityLogout from './components/InactivityLogout'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import Profile from './pages/Profile'
import StudentDashboard from './pages/student/Dashboard'
import StudentModules from './pages/student/Modules'
import StudentPlayground from './pages/student/Playground'
import StudentTasks from './pages/student/Tasks'
import StudentTaskDetail from './pages/student/TaskDetail'
import StudentQuiz from './pages/student/Quiz'
import StudentCollaboration from './pages/student/Collaboration'
import TeacherDashboard from './pages/teacher/Dashboard'
import TeacherUploadModule from './pages/teacher/UploadModule'
import TeacherCreateTask from './pages/teacher/CreateTask'
import TeacherChat from './pages/teacher/Chat'
import TeacherCollaboration from './pages/teacher/Collaboration'
import ParentDashboard from './pages/parent/Dashboard'
import ParentChat from './pages/parent/Chat'

function App() {
  return (
    <BrowserRouter>
      <InactivityLogout>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/profile" element={<Profile />} />

          {/* Siswa */}
          <Route path="/student/dashboard" element={<StudentDashboard />} />
          <Route path="/student/modules" element={<StudentModules />} />
          <Route path="/student/playground" element={<StudentPlayground />} />
          <Route path="/student/tasks" element={<StudentTasks />} />
          <Route path="/student/task/:id" element={<StudentTaskDetail />} />
          <Route path="/student/quiz/:id" element={<StudentQuiz />} />
          <Route path="/student/collaboration" element={<StudentCollaboration />} />

          {/* Guru */}
          <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
          <Route path="/teacher/upload" element={<TeacherUploadModule />} />
          <Route path="/teacher/create-task" element={<TeacherCreateTask />} />
          <Route path="/teacher/chat" element={<TeacherChat />} />
          <Route path="/teacher/collaboration" element={<TeacherCollaboration />} />

          {/* Orang Tua */}
          <Route path="/parent/dashboard" element={<ParentDashboard />} />
          <Route path="/parent/chat" element={<ParentChat />} />
        </Routes>
      </InactivityLogout>
    </BrowserRouter>
  )
}

export default App;
