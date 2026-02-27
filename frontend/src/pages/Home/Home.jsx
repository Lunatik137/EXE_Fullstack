import { useState, useEffect, useContext } from 'react'
import './Home.css'
import DatePicker from '../../components/DatePicker/DatePicker'
import TodayMenu from '../../components/TodayMenu/TodayMenu'
import NutritionStats from '../../components/NutritionStats/NutritionStats'
import ProgressTracker from '../../components/ProgressTracker/ProgressTracker'
import AdPopup from '../../components/AdPopup/AdPopup'
import { StoreContext } from '../../context/StoreContext'
import axios from 'axios'

const Home = () => {
  const { url, token } = useContext(StoreContext)
  const [mealPlan, setMealPlan] = useState(null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchActiveMealPlan = async () => {
      if (!token) return
      
      try {
        const response = await axios.post(
          `${url}/api/meal-plan/get-active`,
          {},
          { headers: { token } }
        )
        
        if (response.data.success) {
          setMealPlan(response.data.mealPlan)
        }
      } catch (error) {
        console.error('Error fetching meal plan:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchActiveMealPlan()
  }, [token, url])

  // Get today's meal data
  const getTodayMeal = () => {
    if (!mealPlan || !mealPlan.days) return null

    const today = selectedDate.toDateString()
    const todayMeal = mealPlan.days.find(day => {
      const dayDate = new Date(day.date).toDateString()
      return dayDate === today
    })

    return todayMeal
  }

  const todayMeal = getTodayMeal()

  return (
    <div className="home-page">
      <AdPopup />
      <div className="home-content">
        <div className="left-column">
          <DatePicker 
            selectedDate={selectedDate} 
            setSelectedDate={setSelectedDate}
            mealPlan={mealPlan}
          />
          <TodayMenu 
            mealPlan={mealPlan} 
            todayMeal={todayMeal}
            loading={loading}
          />
        </div>
        <div className="right-column">
          <ProgressTracker mealPlan={mealPlan} loading={loading} />
        </div>
      </div>
      <NutritionStats todayMeal={todayMeal} loading={loading} />
    </div>
  )
}

export default Home
