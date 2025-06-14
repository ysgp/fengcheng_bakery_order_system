// public/script.js

// 從 firebase-init.js 導入 db 物件
import { db } from './firebase-init.js';
// 導入 Firestore 相關函數
import { collection, addDoc, getDocs, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const orderForm = document.getElementById('orderForm');
    const orderItemsContainer = document.getElementById('orderItemsContainer');
    const addItemBtn = document.getElementById('addItemBtn');
    const orderConfirmationModal = document.getElementById('orderConfirmation');
    const confirmationDetails = document.getElementById('confirmationDetails');
    const confirmOrderBtn = document.getElementById('confirmOrderBtn');
    const editOrderBtn = document.getElementById('editOrderBtn');
    const nameSuffix = document.getElementById('nameSuffix');
    const customerNameInput = document.getElementById('customerName');
    const customerGenderSelect = document.getElementById('customerGender');

    const needsDeliveryCheckbox = document.getElementById('needsDelivery');
    const deliveryInfoDiv = document.getElementById('deliveryInfo');
    const pickupInfoDiv = document.getElementById('pickupInfo');
    const deliveryTimeInput = document.getElementById('deliveryTime');
    const pickupTimeInput = document.getElementById('pickupTime');
    const deliveryAddressInput = document.getElementById('deliveryAddress');
    const totalAmountDisplay = document.getElementById('totalAmountDisplay'); // 新增總金額顯示元素

    let orderItemsCount = 0;
    let currentOrderData = null; // 用來儲存確認前的訂單數據
    
    // 從 Firestore 獲取品項選項 (包含價格資訊)
    let productOptions = {
        cakeType: [],
        cakeSize: [],
        cakeFilling: []
    };

    // 函數：獲取品項選項
    async function fetchProductOptions() {
        try {
            // 直接從 Firestore 獲取 products 集合
            const productsSnapshot = await getDocs(collection(db, "products"));
            productOptions = {
                cakeType: [],
                cakeSize: [],
                cakeFilling: []
            }; // 重置
            productsSnapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                if (product.type === 'cakeType') {
                    productOptions.cakeType.push(product);
                } else if (product.type === 'cakeSize') {
                    productOptions.cakeSize.push(product);
                } else if (product.type === 'cakeFilling') {
                    productOptions.cakeFilling.push(product);
                }
            });
            // 確保每次載入品項後都至少有一個品項選擇器
            if (orderItemsCount === 0) { // 只有在沒有任何品項時才自動增加一個
                addOrderItem();
            } else {
                // 如果已經有品項了，更新現有品項的選項
                document.querySelectorAll('.order-item').forEach((itemDiv) => {
                    updateProductOptionsInItem(itemDiv);
                });
            }
            calculateTotalAmount(); // 重新計算總金額以防萬一
        } catch (error) {
            console.error('獲取品項選項失敗：', error);
            alert('無法載入品項選項，請檢查網路連線或稍後再試。');
        }
    }

    // 函數：更新單個品項選擇器的選項
    function updateProductOptionsInItem(itemDiv) {
        const cakeTypeSelect = itemDiv.querySelector('.cake-type-select');
        const cakeSizeSelect = itemDiv.querySelector('.cake-size-select');
        const cakeFillingSelect = itemDiv.querySelector('.cake-filling-select');

        const currentCakeType = cakeTypeSelect.value;
        const currentCakeSize = cakeSizeSelect.value;
        const currentCakeFilling = cakeFillingSelect.value;

        // 清空現有選項
        cakeTypeSelect.innerHTML = '<option value="">請選擇蛋糕種類</option>';
        cakeSizeSelect.innerHTML = '<option value="">請選擇尺寸</option>';
        cakeFillingSelect.innerHTML = '<option value="">請選擇餡料</option>';

        // 重新填充選項
        productOptions.cakeType.forEach(type => {
            const option = document.createElement('option');
            option.value = type.id;
            option.textContent = type.name;
            cakeTypeSelect.appendChild(option);
        });
        productOptions.cakeSize.forEach(size => {
            const option = document.createElement('option');
            option.value = size.id;
            option.textContent = size.name;
            cakeSizeSelect.appendChild(option);
        });
        productOptions.cakeFilling.forEach(filling => {
            const option = document.createElement('option');
            option.value = filling.id;
            option.textContent = filling.name;
            cakeFillingSelect.appendChild(option);
        });

        // 恢復之前的選擇
        cakeTypeSelect.value = currentCakeType;
        cakeSizeSelect.value = currentCakeSize;
        cakeFillingSelect.value = currentCakeFilling;
    }


    // 函數：增加品項
    function addOrderItem() {
        orderItemsCount++;
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('order-item');
        itemDiv.dataset.id = orderItemsCount; // 為每個品項設定一個唯一ID
        itemDiv.innerHTML = `
            <h3>品項 ${orderItemsCount} <button type="button" class="removeItemBtn">－ 移除品項</button></h3>
            <label for="cakeType${orderItemsCount}">蛋糕種類：</label>
            <select id="cakeType${orderItemsCount}" class="cake-type-select" required>
                <option value="">請選擇蛋糕種類</option>
                ${productOptions.cakeType.map(type => `<option value="${type.id}">${type.name}</option>`).join('')}
            </select><br><br>

            <label for="cakeSize${orderItemsCount}">尺寸：</label>
            <select id="cakeSize${orderItemsCount}" class="cake-size-select" required>
                <option value="">請選擇尺寸</option>
                ${productOptions.cakeSize.map(size => `<option value="${size.id}">${size.name}</option>`).join('')}
            </select><br><br>

            <label for="cakeFilling${orderItemsCount}">餡料：</label>
            <select id="cakeFilling${orderItemsCount}" class="cake-filling-select" required>
                <option value="">請選擇餡料</option>
                ${productOptions.cakeFilling.map(filling => `<option value="${filling.id}">${filling.name}</option>`).join('')}
            </select><br><br>

            <label for="quantity${orderItemsCount}">數量：</label>
            <input type="number" id="quantity${orderItemsCount}" class="quantity-input" min="1" value="1" required><br><br>
        `;
        orderItemsContainer.appendChild(itemDiv);

        // 為新增加的品項綁定事件監聽器
        itemDiv.querySelector('.removeItemBtn').addEventListener('click', (event) => {
            event.target.closest('.order-item').remove();
            calculateTotalAmount(); // 移除後重新計算
        });
        itemDiv.querySelectorAll('select, input[type="number"]').forEach(element => {
            element.addEventListener('change', calculateTotalAmount);
            element.addEventListener('input', calculateTotalAmount); // 處理數量輸入
        });
    }

    // 函數：計算總金額
    function calculateTotalAmount() {
        let total = 0;
        document.querySelectorAll('.order-item').forEach(itemDiv => {
            const cakeTypeId = itemDiv.querySelector('.cake-type-select').value;
            const cakeSizeId = itemDiv.querySelector('.cake-size-select').value;
            const quantity = parseInt(itemDiv.querySelector('.quantity-input').value) || 0;

            const selectedCakeType = productOptions.cakeType.find(type => type.id === cakeTypeId);
            const selectedCakeSize = productOptions.cakeSize.find(size => size.id === cakeSizeId);

            if (selectedCakeType && selectedCakeSize) {
                total += (selectedCakeType.price + selectedCakeSize.price) * quantity;
            }
        });
        totalAmountDisplay.textContent = total;
    }


    addItemBtn.addEventListener('click', addOrderItem);

    // 處理客戶稱謂後綴
    customerGenderSelect.addEventListener('change', updateNameSuffix);
    customerNameInput.addEventListener('input', updateNameSuffix);

    function updateNameSuffix() {
        const customerName = customerNameInput.value.trim();
        const customerGender = customerGenderSelect.value;
        if (customerName) {
            nameSuffix.textContent = customerGender;
        } else {
            nameSuffix.textContent = '';
        }
    }

    // 送貨選項的顯示/隱藏
    needsDeliveryCheckbox.addEventListener('change', () => {
        if (needsDeliveryCheckbox.checked) {
            deliveryInfoDiv.style.display = 'block';
            pickupInfoDiv.style.display = 'none';
            deliveryTimeInput.setAttribute('required', 'required');
            deliveryAddressInput.setAttribute('required', 'required');
            pickupTimeInput.removeAttribute('required');
        } else {
            deliveryInfoDiv.style.display = 'none';
            pickupInfoDiv.style.display = 'block';
            deliveryTimeInput.removeAttribute('required');
            deliveryAddressInput.removeAttribute('required');
            pickupTimeInput.setAttribute('required', 'required');
        }
    });

    // 表單提交事件
    orderForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        // 收集訂單品項
        const items = [];
        let isValid = true;
        document.querySelectorAll('.order-item').forEach(itemDiv => {
            const cakeTypeId = itemDiv.querySelector('.cake-type-select').value;
            const cakeSizeId = itemDiv.querySelector('.cake-size-select').value;
            const cakeFillingId = itemDiv.querySelector('.cake-filling-select').value;
            const quantity = parseInt(itemDiv.querySelector('.quantity-input').value);

            const selectedCakeType = productOptions.cakeType.find(type => type.id === cakeTypeId);
            const selectedCakeSize = productOptions.cakeSize.find(size => size.id === cakeSizeId);
            const selectedCakeFilling = productOptions.cakeFilling.find(filling => filling.id === cakeFillingId);

            if (!selectedCakeType || !selectedCakeSize || !selectedCakeFilling || isNaN(quantity) || quantity <= 0) {
                isValid = false;
                alert('請確保所有蛋糕品項都已選擇且數量有效。');
                return;
            }

            items.push({
                cakeType: { id: selectedCakeType.id, name: selectedCakeType.name, price: selectedCakeType.price },
                cakeSize: { id: selectedCakeSize.id, name: selectedCakeSize.name, price: selectedCakeSize.price },
                cakeFilling: { id: selectedCakeFilling.id, name: selectedCakeFilling.name },
                quantity: quantity
            });
        });

        if (!isValid) return;

        const customerName = customerNameInput.value.trim();
        const customerGender = customerGenderSelect.value;
        const customerPhone = document.getElementById('customerPhone').value.trim();
        const paymentStatus = document.getElementById('paymentStatus').value;
        const needsDelivery = needsDeliveryCheckbox.checked;
        const notes = document.getElementById('notes').value.trim();
        const totalAmount = parseFloat(totalAmountDisplay.textContent);

        let deliveryAddress = '';
        let deliveryTime = null;
        let pickupDateTime = null;

        if (needsDelivery) {
            deliveryAddress = deliveryAddressInput.value.trim();
            deliveryTime = deliveryTimeInput.value;
            if (!deliveryAddress || !deliveryTime) {
                alert('請填寫完整的送貨資訊。');
                return;
            }
            deliveryTime = new Date(deliveryTime); // 轉換為 Date 物件
        } else {
            pickupDateTime = pickupTimeInput.value;
            if (!pickupDateTime) {
                alert('請填寫取貨時間。');
                return;
            }
            pickupDateTime = new Date(pickupDateTime); // 轉換為 Date 物件
        }

        // 檢查日期是否在未來
        const now = new Date();
        now.setSeconds(0,0); // 忽略秒和毫秒，更精確比較
        
        let targetTime = needsDelivery ? deliveryTime : pickupDateTime;
        if (targetTime && targetTime <= now) {
            alert(needsDelivery ? '送貨抵達時間' : '取貨時間' + '必須是未來的時間。');
            return;
        }


        currentOrderData = {
            customerName: customerName,
            customerGender: customerGender,
            customerPhone: customerPhone,
            paymentStatus: paymentStatus,
            needsDelivery: needsDelivery,
            deliveryAddress: deliveryAddress,
            deliveryTime: deliveryTime ? deliveryTime.toISOString() : null, // 存儲為 ISO 字符串
            pickupDateTime: pickupDateTime ? pickupDateTime.toISOString() : null, // 存儲為 ISO 字符串
            notes: notes,
            items: items,
            totalAmount: totalAmount,
            orderStatus: '尚未製作', // 預設訂單狀態
            createdAt: serverTimestamp() // 使用 Firestore 的時間戳
        };

        showConfirmationModal(currentOrderData);
    });

    function showConfirmationModal(orderData) {
        let itemsHtml = orderData.items.map(item => `
            <li>
                ${item.cakeType.name} (${item.cakeSize.name}) - ${item.cakeFilling.name}, 數量: ${item.quantity}
                (單價: ${item.cakeType.price + item.cakeSize.price}元)
            </li>
        `).join('');

        const dateTimeInfo = orderData.needsDelivery
            ? `送貨地址: ${orderData.deliveryAddress}<br>送貨抵達時間: ${orderData.deliveryTime ? new Date(orderData.deliveryTime).toLocaleString() : '未設定'}`
            : `取貨時間: ${orderData.pickupDateTime ? new Date(orderData.pickupDateTime).toLocaleString() : '未設定'}`;

        confirmationDetails.innerHTML = `
            <p><strong>客戶姓名:</strong> ${orderData.customerName} ${orderData.customerGender}</p>
            <p><strong>客戶電話:</strong> ${orderData.customerPhone}</p>
            <p><strong>付款狀態:</strong> ${orderData.paymentStatus}</p>
            <p><strong>總金額:</strong> ${orderData.totalAmount} 元</p>
            <h3>訂購品項:</h3>
            <ul>${itemsHtml}</ul>
            <p><strong>${dateTimeInfo}</strong></p>
            <p><strong>備註:</strong> ${orderData.notes || '無'}</p>
            <p><strong>訂單狀態:</strong> ${orderData.orderStatus}</p>
        `;
        orderConfirmationModal.style.display = 'block';
    }

    // 編輯按鈕：隱藏模態框，返回編輯
    editOrderBtn.addEventListener('click', () => {
        orderConfirmationModal.style.display = 'none'; // 隱藏 Modal 返回編輯
    });

    // 確認送出按鈕：實際將資料寫入 Firestore
    confirmOrderBtn.addEventListener('click', async () => {
        try {
            // 將訂單資料新增到 Firestore 的 'orders' 集合中
            const docRef = await addDoc(collection(db, "orders"), currentOrderData);
            alert('訂單建立成功！訂單ID: ' + docRef.id);
            orderForm.reset(); // 重置表單
            orderItemsContainer.innerHTML = '<h2>蛋糕品項 <button type="button" id="addItemBtn">＋ 增加品項</button></h2>'; // 清空品項
            document.getElementById('addItemBtn').addEventListener('click', addOrderItem); // 重新綁定
            fetchProductOptions(); // 重新載入品項並添加初始品項
            needsDeliveryCheckbox.checked = false; // 重置送貨選項
            deliveryInfoDiv.style.display = 'none';
            pickupInfoDiv.style.display = 'block'; // 預設顯示取貨資訊
            pickupTimeInput.setAttribute('required', 'required'); // 確保取貨時間為必填
            deliveryTimeInput.removeAttribute('required');
            deliveryAddressInput.removeAttribute('required');
            updateNameSuffix(); // 清空性別後綴顯示
            calculateTotalAmount(); // 重置總金額顯示為 0
        } catch (error) {
            console.error('建立訂單錯誤：', error);
            alert('建立訂單失敗：' + error.message);
        } finally {
            orderConfirmationModal.style.display = 'none'; // 無論成功失敗都隱藏 Modal
        }
    });

    // 頁面載入時先獲取品項選項
    fetchProductOptions();
    updateNameSuffix(); // 初始顯示清空稱謂
    calculateTotalAmount(); // 初始顯示總金額為 0

});