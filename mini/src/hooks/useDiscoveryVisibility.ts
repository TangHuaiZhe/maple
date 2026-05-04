import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { DISCOVERY_VISIBILITY_STORAGE_KEY } from '../utils/discovery'

function readDiscoveryVisibility() {
  try {
    const value = Taro.getStorageSync(DISCOVERY_VISIBILITY_STORAGE_KEY)
    return value === true || value === '1' || value === 1
  } catch {
    return false
  }
}

export function useDiscoveryVisibility() {
  const [showDiscoveryCultivars, setShowDiscoveryCultivars] = useState<boolean>(() => readDiscoveryVisibility())

  useEffect(() => {
    try {
      Taro.setStorageSync(DISCOVERY_VISIBILITY_STORAGE_KEY, showDiscoveryCultivars ? '1' : '0')
    } catch {}
  }, [showDiscoveryCultivars])

  return {
    showDiscoveryCultivars,
    setShowDiscoveryCultivars,
  }
}
