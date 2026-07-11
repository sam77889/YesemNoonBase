import { useState, useEffect } from 'react';
import { useDeviceDetect } from './hooks/useDeviceDetect';
import { MobileApp } from './pages/MobileApp';
import { DesktopApp } from './DesktopApp';

export default function App() {
  const { isMobile } = useDeviceDetect();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // 监听 popstate 确保浏览器前进/后退正常运行
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 路由判定逻辑
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isMobile && currentPath !== '/mobile') {
        window.history.replaceState(null, '', '/mobile');
        setCurrentPath('/mobile');
      } else if (!isMobile && currentPath === '/mobile') {
        window.history.replaceState(null, '', '/');
        setCurrentPath('/');
      }
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [isMobile, currentPath]);

  // 分流渲染
  if (currentPath === '/mobile') {
    return <MobileApp />;
  }

  return <DesktopApp />;
}
