// public/products.js

// 從 firebase-init.js 導入 db 物件
import { db } from './firebase-init.js';
// 導入 Firestore 相關函數
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const addProductForm = document.getElementById('addProductForm');
    const productTypeSelect = document.getElementById('productType');
    const productNameInput = document.getElementById('productName');
    const productPriceField = document.getElementById('productPriceField'); // 新增價格欄位
    const productPriceInput = document.getElementById('productPrice');     // 新增價格輸入框
    const productsListContainer = document.getElementById('productsListContainer');

    const editProductModal = document.getElementById('editProductModal');
    const editProductForm = document.getElementById('editProductForm');
    const editProductTypeInput = document.getElementById('editProductType');
    const editProductNameInput = document.getElementById('editProductName');
    const editProductPriceField = document.getElementById('editProductPriceField'); // 編輯時的價格欄位
    const editProductPriceInput = document.getElementById('editProductPrice');     // 編輯時的價格輸入框
    const cancelEditProductBtn = document.getElementById('cancelEditProductBtn');

    let currentEditingProductId = null; // 儲存當前正在編輯的品項 ID

    // 根據選擇的品項類型顯示/隱藏價格輸入框
    productTypeSelect.addEventListener('change', () => {
        if (productTypeSelect.value === 'cakeType' || productTypeSelect.value === 'cakeSize') {
            productPriceField.style.display = 'block';
            productPriceInput.setAttribute('required', 'required'); // 設為必填
        } else {
            productPriceField.style.display = 'none';
            productPriceInput.removeAttribute('required'); // 移除必填
            productPriceInput.value = ''; // 清空價格
        }
    });

    // 新增品項表單提交
    addProductForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const type = productTypeSelect.value;
        const name = productNameInput.value.trim();
        let price = null;

        if (type === 'cakeType' || type === 'cakeSize') {
            price = parseFloat(productPriceInput.value);
            if (isNaN(price) || price < 0) {
                alert('蛋糕種類和尺寸必須提供有效且非負的價格。');
                return;
            }
        }

        const productData = { type, name, price };

        try {
            // 將品項資料新增到 Firestore 的 'products' 集合中
            const docRef = await addDoc(collection(db, "products"), productData);
            alert('品項新增成功！');
            addProductForm.reset(); // 重置表單
            productPriceField.style.display = 'none'; // 隱藏價格欄位
            productPriceInput.removeAttribute('required'); // 移除必填
            fetchAndDisplayProducts(); // 重新載入並顯示品項
        } catch (error) {
            console.error('新增品項失敗：', error);
            alert('新增品項失敗：' + error.message);
        }
    });

    // 函數：從 Firestore 獲取並顯示所有品項
    async function fetchAndDisplayProducts() {
        productsListContainer.innerHTML = '<p>載入品項中...</p>'; // 顯示載入訊息

        try {
            // 從 Firestore 獲取所有 products 集合
            const querySnapshot = await getDocs(collection(db, "products"));
            const products = [];
            querySnapshot.forEach(doc => {
                products.push({ id: doc.id, ...doc.data() });
            });

            if (products.length === 0) {
                productsListContainer.innerHTML = '<p>目前沒有任何品項。</p>';
                return;
            }

            let html = '<table><thead><tr><th>類型</th><th>名稱</th><th>價格</th><th>操作</th></tr></thead><tbody>';
            products.forEach(product => {
                const priceDisplay = product.price !== null ? `${product.price} 元` : 'N/A';
                html += `
                    <tr>
                        <td>${product.type}</td>
                        <td>${product.name}</td>
                        <td>${priceDisplay}</td>
                        <td>
                            <button class="edit-btn" data-id="${product.id}">編輯</button>
                            <button class="delete-btn" data-id="${product.id}">刪除</button>
                        </td>
                    </tr>
                `;
            });
            html += '</tbody></table>';
            productsListContainer.innerHTML = html;

            // 為按鈕添加事件監聽器
            document.querySelectorAll('.edit-btn').forEach(button => {
                button.addEventListener('click', (event) => {
                    editProduct(event.target.dataset.id);
                });
            });
            document.querySelectorAll('.delete-btn').forEach(button => {
                button.addEventListener('click', (event) => {
                    deleteProduct(event.target.dataset.id);
                });
            });

        } catch (error) {
            console.error('獲取品項失敗：', error);
            productsListContainer.innerHTML = '<p>載入品項失敗，請檢查網路連線或稍後再試。</p>';
        }
    }

    // 函數：編輯品項
    async function editProduct(productId) {
        currentEditingProductId = productId; // 儲存當前編輯的品項ID
        try {
            // 從 Firestore 獲取單個品項資料
            const productDoc = await doc(db, "products", productId).get();
            if (!productDoc.exists) {
                alert('品項不存在！');
                return;
            }
            const product = { id: productDoc.id, ...productDoc.data() };

            editProductTypeInput.value = product.type;
            editProductNameInput.value = product.name;
            
            // 根據類型顯示/隱藏價格欄位
            if (product.type === 'cakeType' || product.type === 'cakeSize') {
                editProductPriceField.style.display = 'block';
                editProductPriceInput.value = product.price !== null ? product.price : '';
                editProductPriceInput.setAttribute('required', 'required');
            } else {
                editProductPriceField.style.display = 'none';
                editProductPriceInput.removeAttribute('required');
                editProductPriceInput.value = ''; // 清空價格
            }

            editProductModal.style.display = 'block'; // 顯示 Modal
        } catch (error) {
            console.error('獲取品項詳情失敗：', error);
            alert('載入品項詳情失敗，請檢查網路連線或稍後再試。');
        }
    }

    // 編輯表單提交事件
    editProductForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const updatedData = {
            name: editProductNameInput.value.trim(),
        };

        const type = editProductTypeInput.value; // 品項類型是只讀的，直接取值

        if (type === 'cakeType' || type === 'cakeSize') {
            const price = parseFloat(editProductPriceInput.value);
            if (isNaN(price) || price < 0) {
                alert('蛋糕種類和尺寸必須提供有效且非負的價格。');
                return;
            }
            updatedData.price = price;
        } else {
            updatedData.price = null; // 對於沒有價格的類型，設置為 null
        }

        try {
            // 更新 Firestore 中的品項
            const productDocRef = doc(db, "products", currentEditingProductId);
            await updateDoc(productDocRef, updatedData);
            
            alert('品項更新成功！');
            editProductModal.style.display = 'none'; // 隱藏 Modal
            fetchAndDisplayProducts(); // 重新載入品項列表
        } catch (error) {
            console.error('更新品項錯誤：', error);
            alert('更新品項失敗：' + error.message);
        }
    });

    // 取消編輯品項
    cancelEditProductBtn.addEventListener('click', () => {
        editProductModal.style.display = 'none';
    });

    // 函數：刪除品項
    async function deleteProduct(productId) {
        if (confirm('確定要刪除這個品項嗎？此操作無法復原。')) {
            try {
                // 從 Firestore 刪除品項
                const productDocRef = doc(db, "products", productId);
                await deleteDoc(productDocRef);
                alert('品項刪除成功！');
                fetchAndDisplayProducts(); // 重新載入品項列表
            } catch (error) {
                console.error('刪除品項失敗：', error);
                alert('刪除品項失敗：' + error.message);
            }
        }
    }

    // 頁面載入時執行
    fetchAndDisplayProducts();
});