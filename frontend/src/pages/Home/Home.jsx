import { useState, useEffect, useContext } from 'react'
import './Home.css'
import DatePicker from '../../components/DatePicker/DatePicker'
import TodayMenu from '../../components/TodayMenu/TodayMenu'
import NutritionStats from '../../components/NutritionStats/NutritionStats'
import ProgressTracker from '../../components/ProgressTracker/ProgressTracker'
import { StoreContext } from '../../context/StoreContext'
import axios from 'axios'
import MobileAd from '../../components/MobileAd/MobileAd'
import { toast } from 'react-toastify'

const SELECTED_DATE_STORAGE_KEY = 'home_selected_date'

const parseSavedDate = (rawValue) => {
  if (!rawValue) return null
  const parsed = new Date(rawValue)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const Home = () => {
  const { url, token } = useContext(StoreContext)
  const [mealPlan, setMealPlan] = useState(null)
  const [subscriptionInfo, setSubscriptionInfo] = useState(null)
  const [streakStatus, setStreakStatus] = useState(null)
  const [selectedDate, setSelectedDate] = useState(() => {
    const savedDate = parseSavedDate(localStorage.getItem(SELECTED_DATE_STORAGE_KEY))
    return savedDate || new Date()
  })
  const [loading, setLoading] = useState(true)
  const [recoveringStreak, setRecoveringStreak] = useState(false)
  const [confirmingMeal, setConfirmingMeal] = useState('')
  const [manualNutrition, setManualNutrition] = useState(null)

  useEffect(() => {
    if (!(selectedDate instanceof Date) || Number.isNaN(selectedDate.getTime())) return
    localStorage.setItem(SELECTED_DATE_STORAGE_KEY, selectedDate.toISOString())
  }, [selectedDate])

  useEffect(() => {
    const fetchActiveMealPlan = async () => {
      if (!token) return
      
      try {
        const [mealPlanRes, profileRes, streakRes] = await Promise.all([
          axios.post(
            `${url}/api/meal-plan/get-active`,
            {},
            { headers: { token } }
          ),
          axios.post(
            `${url}/api/user/profile`,
            {},
            { headers: { token } }
          ),
          axios.post(
            `${url}/api/streak/status`,
            {},
            { headers: { token } }
          )
        ])

        if (mealPlanRes.data.success) {
          setMealPlan(mealPlanRes.data.mealPlan)
        }

        if (profileRes.data.success && profileRes.data.user) {
          setSubscriptionInfo({
            planType: profileRes.data.user.planType,
            subscriptionStatus: profileRes.data.user.subscriptionStatus,
            subscriptionEndDate: profileRes.data.user.subscriptionEndDate
          })
        }

        if (streakRes.data.success) {
          setStreakStatus(streakRes.data.streak)
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

  // Reset manualNutrition when changing day or todayMeal
  useEffect(() => {
    setManualNutrition(null);
  }, [selectedDate, todayMeal]);

  const applyLocalMealConfirmation = (baseStatus, mealType) => {
    if (!baseStatus || !mealType) return baseStatus

    const currentMeal = baseStatus.meals?.[mealType] || {}
    if (currentMeal.confirmed) {
      return baseStatus
    }

    const nextConfirmedMeals = Math.max(
      Number(baseStatus.todayProgress?.confirmedMeals || 0) + 1,
      Number(baseStatus.todayProgress?.confirmedMeals || 0)
    )
    const requiredMeals = Number(baseStatus.todayProgress?.requiredMeals || 2)

    return {
      ...baseStatus,
      meals: {
        ...(baseStatus.meals || {}),
        [mealType]: {
          ...currentMeal,
          confirmed: true,
          confirmedAt: new Date().toISOString(),
          canConfirm: false,
          disabledReason: 'Bạn đã xác nhận bữa này rồi'
        }
      },
      todayProgress: {
        ...(baseStatus.todayProgress || {}),
        confirmedMeals: nextConfirmedMeals,
        qualified: nextConfirmedMeals >= requiredMeals
      }
    }
  }

  const handleConfirmMeal = async (mealType) => {
    if (!token || !mealType) return

    try {
      setConfirmingMeal(mealType)
      const response = await axios.post(
        `${url}/api/streak/confirm-meal`,
        { mealType },
        { headers: { token } }
      )

      if (response.data.success) {
        setStreakStatus((previous) => {
          const serverStatus = response.data.streak || previous
          const updated = applyLocalMealConfirmation(serverStatus, mealType)
          window.dispatchEvent(new CustomEvent('streakConfirmed', { detail: updated }))
          return updated
        })
        toast.success(response.data.message || 'Đã xác nhận bữa ăn')
      } else {
        toast.error(response.data.message || 'Không thể xác nhận bữa ăn')
      }
    } catch (error) {
      console.error('Error confirming meal:', error)
      toast.error('Có lỗi xảy ra khi xác nhận bữa ăn')
    } finally {
      setConfirmingMeal('')
    }
  }

  const handleRecoverStreak = async () => {
    if (!token) return

    try {
      setRecoveringStreak(true)
      const response = await axios.post(
        `${url}/api/streak/recover`,
        {},
        { headers: { token } }
      )

      if (response.data.success) {
        setStreakStatus(response.data.streak)
        toast.success(response.data.message || 'Đã phục hồi chuỗi')
      } else {
        toast.error(response.data.message || 'Không thể phục hồi chuỗi')
      }
    } catch (error) {
      console.error('Error recovering streak:', error)
      toast.error('Có lỗi xảy ra khi phục hồi chuỗi')
    } finally {
      setRecoveringStreak(false)
    }
  }

  const isTrulyPremium =
    subscriptionInfo?.planType === 'premium' &&
    subscriptionInfo?.subscriptionStatus === 'active' &&
    subscriptionInfo?.subscriptionEndDate &&
    new Date(subscriptionInfo.subscriptionEndDate) > new Date()

  return (
    <div className="home-page">
      {!loading && !isTrulyPremium && <MobileAd />}
      <div className="home-content">
        <div className="left-column">
          <DatePicker 
            selectedDate={selectedDate} 
            setSelectedDate={setSelectedDate}
            mealPlan={mealPlan}
            subscriptionInfo={subscriptionInfo}
          />
          <TodayMenu 
            mealPlan={mealPlan} 
            todayMeal={todayMeal}
            loading={loading}
            subscriptionInfo={subscriptionInfo}
            selectedDate={selectedDate}
            streakStatus={streakStatus}
            confirmingMeal={confirmingMeal}
            onConfirmMeal={handleConfirmMeal}
            onManualNutritionChange={setManualNutrition}
          />
        </div>
        <div className="right-column">
          <ProgressTracker
            mealPlan={mealPlan}
            loading={loading}
            subscriptionInfo={subscriptionInfo}
            streakStatus={streakStatus}
            recoveringStreak={recoveringStreak}
            onRecoverStreak={handleRecoverStreak}
          />
        </div>
      </div>
      <NutritionStats todayMeal={todayMeal} loading={loading} manualMealNutrition={manualNutrition} />
    </div>
  )
}

export default Home
