import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { PWAInstallButton } from './PWAInstallButton';

export const AdminPWAButton = () => {
  const location = useLocation();
  const [isCorrectUrl, setIsCorrectUrl] = useState(false);

  useEffect(() => {
    // Check if we're on the admin login URL
    const isAdminLogin = location.pathname === '/admin/login' || 
                        location.hash === '#/admin/login' ||
                        window.location.href.includes('/admin/login');
    
    setIsCorrectUrl(isAdminLogin);
    
    console.log('🔍 AdminPWAButton URL check:', {
      pathname: location.pathname,
      hash: location.hash,
      href: window.location.href,
      isAdminLogin,
      isCorrectUrl: isAdminLogin,
      userAgent: navigator.userAgent
    });
  }, [location]);

  // For now, always redirect to test page since it works
  return (
    <button
      onClick={() => {
        console.log('🔄 Redirecting to test admin page');
        window.location.href = `${window.location.origin}/test-admin-direct.html`;
      }}
      className="text-xs sm:text-sm text-white/80 hover:text-white transition-colors px-3 py-2 rounded hover:bg-white/20 border border-white/20 hover:border-white/40"
      style={{ cursor: 'pointer' }}
    >
      📱 Instalar app Admin
    </button>
  );
};
