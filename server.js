require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

let serviceAccount;
try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
} catch (e) {
    console.error("解析 FIREBASE_SERVICE_ACCOUNT_KEY 失敗，請檢查 .env 檔案格式或內容。", e);
    process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 路由：首頁
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 路由：訂單管理頁面
app.get('/manage.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manage.html'));
});

// 路由：工作台頁面
app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// 路由：品項管理頁面
app.get('/products.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'products.html'));
});

// --- API 路由 ---

// API 路由：獲取所有訂單
app.get('/api/orders', async (req, res) => {
  try {
    const ordersRef = db.collection('orders');
    const snapshot = await ordersRef.get();
    const orders = [];
    snapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    res.status(200).json(orders);
  } catch (error) {
    console.error("獲取訂單失敗：", error);
    res.status(500).send("獲取訂單失敗：" + error.message);
  }
});

// API 路由：獲取特定訂單的詳情
app.get('/api/orders/:id', async (req, res) => {
  try {
    const orderId = req.params.id;
    const orderDoc = await db.collection('orders').doc(orderId).get();

    if (!orderDoc.exists) {
      return res.status(404).send("找不到該訂單");
    }

    res.status(200).json({ id: orderDoc.id, ...orderDoc.data() });
  } catch (error) {
    console.error("獲取訂單詳情失敗：", error);
    res.status(500).send("獲取訂單詳情失敗：" + error.message);
  }
});

// API 路由：新增訂單 (修改：增加 displayId, totalAmount, 並處理 createdAt)
app.post('/api/orders', async (req, res) => {
  try {
    const orderData = req.body;

    // 簡單驗證 totalAmount 是否存在
    if (typeof orderData.totalAmount === 'undefined' || orderData.totalAmount < 0) {
        return res.status(400).send("訂單總價無效。");
    }

    const newOrderRef = db.collection('orders').doc();
    
    // 生成一個短的顯示用 ID (原始 Firestore ID 的前8個字元)
    const displayId = newOrderRef.id.substring(0, 8).toUpperCase(); 

    // 將 displayId 和建立時間加入訂單數據
    await newOrderRef.set({
      ...orderData,
      displayId: displayId, // 新增 displayId 欄位
      createdAt: new Date().toISOString() // 新增建立時間
    });

    res.status(201).json({ message: '訂單建立成功！', orderId: newOrderRef.id, displayId: displayId });
  } catch (error) {
    console.error("建立訂單失敗：", error);
    res.status(500).send("建立訂單失敗：" + error.message);
  }
});

// API 路由：更新訂單 (修改：允許更新 totalAmount)
app.put('/api/orders/:id', async (req, res) => {
  try {
    const orderId = req.params.id;
    const updatedData = req.body;

    // 如果更新數據包含 totalAmount，進行簡單驗證
    if (typeof updatedData.totalAmount !== 'undefined' && updatedData.totalAmount < 0) {
        return res.status(400).send("訂單總價無效。");
    }

    await db.collection('orders').doc(orderId).update(updatedData);

    res.status(200).json({ message: '訂單更新成功！' });
  } catch (error) {
    console.error("更新訂單失敗：", error);
    res.status(500).send("更新訂單失敗：" + error.message);
  }
});

// API 路由：刪除訂單
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const orderId = req.params.id;
    
    await db.collection('orders').doc(orderId).delete();

    res.status(200).json({ message: '訂單刪除成功！' });
  } catch (error) {
    console.error("刪除訂單失敗：", error);
    res.status(500).send("刪除訂單失敗：" + error.message);
  }
});

// --- 品項管理 API 路由 ---

// API 路由：獲取所有品項 (修改：包含價格資訊)
app.get('/api/products', async (req, res) => {
  try {
    const productsRef = db.collection('products');
    const snapshot = await productsRef.get();
    const products = [];
    snapshot.forEach(doc => {
      products.push({ id: doc.id, ...doc.data() });
    });
    res.status(200).json(products);
  } catch (error) {
    console.error("獲取品項失敗：", error);
    res.status(500).send("獲取品項失敗：" + error.message);
  }
});

// API 路由：獲取單一品項詳情 (新增此路由，供前端編輯品項時使用)
app.get('/api/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const productDoc = await db.collection('products').doc(productId).get();

        if (!productDoc.exists) {
            return res.status(404).send("找不到該品項");
        }
        res.status(200).json({ id: productDoc.id, ...productDoc.data() });
    } catch (error) {
        console.error("獲取品項詳情失敗：", error);
        res.status(500).send("獲取品項詳情失敗：" + error.message);
    }
});


// API 路由：新增品項 (修改：允許包含價格)
app.post('/api/products', async (req, res) => {
  try {
    const productData = req.body;
    // 簡單驗證品項類型
    if (!['cakeType', 'cakeSize', 'cakeFilling'].includes(productData.type)) {
      return res.status(400).send('無效的品項類型');
    }
    if (!productData.name) {
      return res.status(400).send('品項名稱不可為空');
    }
    // 如果是 cakeType 或 cakeSize，需要 price 欄位 (可選，但建議有)
    if (['cakeType', 'cakeSize'].includes(productData.type)) {
        if (typeof productData.price === 'undefined' || productData.price < 0) {
            // 如果沒有提供價格，可以設定一個預設值，或者要求必須提供
            // 這裡要求必須提供
            return res.status(400).send('蛋糕種類和尺寸必須提供價格且不可為負值');
        }
    }


    const newProductRef = db.collection('products').doc();
    await newProductRef.set(productData);
    res.status(201).json({ message: '品項新增成功！', productId: newProductRef.id });
  } catch (error) {
    console.error("新增品項失敗：", error);
    res.status(500).send("新增品項失敗：" + error.message);
  }
});

// API 路由：更新品項 (修改：允許更新價格)
app.put('/api/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const updatedData = req.body;

    // 如果更新數據包含 price，進行簡單驗證
    if (typeof updatedData.price !== 'undefined' && updatedData.price < 0) {
        return res.status(400).send("品項價格無效。");
    }

    await db.collection('products').doc(productId).update(updatedData);
    res.status(200).json({ message: '品項更新成功！' });
  } catch (error) {
    console.error("更新品項失敗：", error);
    res.status(500).send("更新品項失敗：" + error.message);
  }
});

// API 路由：刪除品項
app.delete('/api/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    await db.collection('products').doc(productId).delete();
    res.status(200).json({ message: '品項刪除成功！' });
  } catch (error) {
    console.error("刪除品項失敗：", error);
    res.status(500).send("刪除品項失敗：" + error.message);
  }
});


// 啟動伺服器
app.listen(PORT, () => {
  console.log(`伺服器運行在 http://localhost:${PORT}`);
});