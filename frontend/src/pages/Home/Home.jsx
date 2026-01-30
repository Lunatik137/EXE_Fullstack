import './Home.css'
import TodayMenu from '../../components/TodayMenu/TodayMenu'
import ProgressTracker from '../../components/ProgressTracker/ProgressTracker'

const Home = () => {
  return (
    <div className="home-page">
      <TodayMenu />
      <ProgressTracker />
    </div>
  )
}

export default Home
