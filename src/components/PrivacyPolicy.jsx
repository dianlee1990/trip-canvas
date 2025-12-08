import React from 'react';

const PrivacyPolicy = () => {
  const styles = {
    container: { maxWidth: '800px', margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif', lineHeight: '1.6', color: '#333' },
    h1: { borderBottom: '1px solid #ddd', paddingBottom: '10px' },
    section: { marginTop: '20px', fontWeight: 'bold' }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.h1}>隱私權政策 (Privacy Policy)</h1>
      <p><strong>生效日期：</strong>2025年 12 月 08 日</p>
      
      <div style={styles.section}>1. 簡介</div>
      <p>歡迎使用 Trip Canvas。我們重視您的隱私，並遵守台灣《個人資料保護法》。本政策說明我們如何處理您的資料。</p>

      <div style={styles.section}>2. 我們蒐集的資料</div>
      <ul>
        <li><strong>帳戶資訊：</strong>透過 Google 登入取得的基本資料（如 Email）。</li>
        <li><strong>行程資料：</strong>您建立的旅遊行程內容。</li>
      </ul>

      <div style={styles.section}>3. Google 用戶數據的使用</div>
      <p>針對「匯出至 Google 日曆」功能：</p>
      <ul>
        <li>我們僅請求「寫入日曆」權限。</li>
        <li>您的資料僅用於將行程匯入您的日曆，<strong>不會</strong>儲存於我們的伺服器，也<strong>不會</strong>分享給第三方。</li>
      </ul>

      <div style={styles.section}>4. 聯絡我們</div>
      <p>如有疑問，請聯繫開發團隊。</p>
    </div>
  );
};

export default PrivacyPolicy;