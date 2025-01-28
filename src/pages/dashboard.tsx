import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Cursor AI - Profesyonel Business Plan</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">CURSOR AI - AYLIK PROFESYONEL BUSİNESS PLAN</h2>
          <div className="text-3xl font-bold text-blue-600 mb-4">850 TL</div>
          
          <h3 className="text-xl font-semibold mb-4">ÖZELLİKLERİ:</h3>
          <ul className="space-y-2">
            <li>✓ Limitsiz ChatGPT-O1 Model Kullanımı</li>
            <li>✓ Limitsiz Claude 3.5 Sonnet Kullanımı</li>
            <li>✓ Limitsiz Gemini Kullanımı</li>
            <li>✓ Kendi CURSOR Hesabınızı Kullanırsınız</li>
            <li>✓ Profesyonel Business Hesap</li>
            <li>✓ 1 Aylık Sınırsız Proje ve Hızlı Fast Kullanım Modu</li>
            <li>✓ 5000 request kapasitesi</li>
            <li>✓ 10 hesap gücü kullanımı</li>
            <li>✓ Gizlilik garantisi</li>
            <li>✓ Uygun maliyet</li>
          </ul>

          <div className="mt-8">
            <button className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600">
              Hemen Satın Al
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 