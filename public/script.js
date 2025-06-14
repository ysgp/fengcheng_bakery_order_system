// public/script.js

// 從 firebase-init.js 導入 db 物件
import { db } from './firebase-init.js';
// 導入 Firestore 相關函數
import { collection, addDoc, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";

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
    
    let productOptions = {
        cakeType: [],
        cakeSize: [],
        cakeFilling: []
    };

    // 獲取品項選項
    async function fetchProductOptions() {
        try {
            const querySnapshot = await getDocs(collection(db, "products"));
            productOptions = {
                cakeType: [],
                cakeSize: [],
                cakeFilling: []
            };
            querySnapshot.forEach((doc) => {
                const product = { id: doc.id, ...doc.data() };
                if (productOptions[product.type]) {
                    productOptions[product.type].push(product);
                }
            });
            renderOrderItemOptions(); // 渲染品項選擇框
            console.log("產品選項載入成功:", productOptions);
        } catch (error) {
            console.error('獲取品項選項失敗：', error);
            alert('載入品項時發生錯誤，請稍後再試。');
        }
    }

    // 渲染單個品項的 HTML 結構
    function renderOrderItemOptions() {
        // 清除現有品項（除了標題和按鈕）
        // 為了避免重複渲染，我們每次重新渲染時先清空再添加
        const existingItems = orderItemsContainer.querySelectorAll('.order-item');
        existingItems.forEach(item => item.remove());

        if (orderItemsCount === 0) { // 如果沒有品項，則添加一個空的
            addOrderItem();
        } else { // 如果有，則根據目前的 orderItemsCount 重新添加
            const currentItems = orderItemsCount; // 記錄當前數量
            orderItemsCount = 0; // 重置計數器以確保 addOrderItem 從 1 開始
            for (let i = 0; i < currentItems; i++) {
                addOrderItem(); // 重新添加現有品項數量
            }
        }
    }


    function addOrderItem() {
        orderItemsCount++;
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('order-item');
        itemDiv.dataset.id = orderItemsCount;

        itemDiv.innerHTML = `
            <h3>品項 ${orderItemsCount} <button type="button" class="remove-item-btn" data-id="${orderItemsCount}">X</button></h3>
            <label for="cakeType${orderItemsCount}">蛋糕種類：</label>
            <select id="cakeType${orderItemsCount}" class="cake-type" required>
                <option value="">請選擇</option>
                ${productOptions.cakeType.map(type => `<option value="${type.id}" data-price="${type.price}">${type.name}</option>`).join('')}
            </select><br><br>

            <label for="cakeSize${orderItemsCount}">尺寸：</label>
            <select id="cakeSize${orderItemsCount}" class="cake-size" required>
                <option value="">請選擇</option>
                ${productOptions.cakeSize.map(size => `<option value="${size.id}" data-price="${size.price}">${size.name}</option>`).join('')}
            </select><br><br>

            <label for="cakeFilling${orderItemsCount}">餡料：</label>
            <select id="cakeFilling${orderItemsCount}" class="cake-filling" required>
                <option value="">請選擇</option>
                ${productOptions.cakeFilling.map(filling => `<option value="${filling.id}">${filling.name}</option>`).join('')}
            </select><br><br>

            <label for="quantity${orderItemsCount}">數量：</label>
            <input type="number" id="quantity${orderItemsCount}" class="quantity" value="1" min="1" required><br><br>
        `;
        orderItemsContainer.appendChild(itemDiv);

        // 為新添加的品項綁定事件監聽器，以便計算總金額
        itemDiv.querySelectorAll('.cake-type, .cake-size, .quantity').forEach(element => {
            element.addEventListener('change', calculateTotalAmount);
            element.addEventListener('input', calculateTotalAmount); // 處理數量直接輸入
        });

        itemDiv.querySelector('.remove-item-btn').addEventListener('click', removeOrderItem);

        calculateTotalAmount(); // 每次添加品項後重新計算總金額
    }

    function removeOrderItem(event) {
        const itemId = event.target.dataset.id;
        document.querySelector(`.order-item[data-id="${itemId}"]`).remove();
        // 重新編號剩餘的品項，保持順序
        orderItemsCount = 0; // 重置計數器
        document.querySelectorAll('.order-item').forEach((itemDiv, index) => {
            orderItemsCount++;
            itemDiv.dataset.id = orderItemsCount;
            itemDiv.querySelector('h3').innerHTML = `品項 ${orderItemsCount} <button type="button" class="remove-item-btn" data-id="${orderItemsCount}">X</button>`;
            itemDiv.querySelector('.remove-item-btn').dataset.id = orderItemsCount;
            // 更新相關聯的 label for 和 input/select id
            const oldId = index + 1; // 假設舊 ID 是基於 1 的順序
            itemDiv.innerHTML = itemDiv.innerHTML.replace(new RegExp(`cakeType${oldId}`, 'g'), `cakeType${orderItemsCount}`)
                                                .replace(new RegExp(`cakeSize${oldId}`, 'g'), `cakeSize${orderItemsCount}`)
                                                .replace(new RegExp(`cakeFilling${oldId}`, 'g'), `cakeFilling${orderItemsCount}`)
                                                .replace(new RegExp(`quantity${oldId}`, 'g'), `quantity${orderItemsCount}`);
        });
        calculateTotalAmount(); // 重新計算總金額
    }

    // 計算總金額
    function calculateTotalAmount() {
        let total = 0;
        document.querySelectorAll('.order-item').forEach(itemDiv => {
            const cakeTypeSelect = itemDiv.querySelector('.cake-type');
            const cakeSizeSelect = itemDiv.querySelector('.cake-size');
            const quantityInput = itemDiv.querySelector('.quantity');

            const selectedTypeOption = cakeTypeSelect.options[cakeTypeSelect.selectedIndex];
            const selectedSizeOption = cakeSizeSelect.options[cakeSizeSelect.selectedIndex];

            const typePrice = selectedTypeOption && selectedTypeOption.dataset.price ? parseFloat(selectedTypeOption.dataset.price) : 0;
            const sizePrice = selectedSizeOption && selectedSizeOption.dataset.price ? parseFloat(selectedSizeOption.dataset.price) : 0;
            const quantity = parseInt(quantityInput.value) || 0;

            if (typePrice > 0 && sizePrice > 0 && quantity > 0) {
                total += (typePrice + sizePrice) * quantity;
            }
        });
        totalAmountDisplay.textContent = total;
    }

    // 更新姓名後綴 (先生/小姐)
    function updateNameSuffix() {
        const name = customerNameInput.value.trim();
        const gender = customerGenderSelect.value;
        if (name) {
            nameSuffix.textContent = ` ${gender}`;
        } else {
            nameSuffix.textContent = '';
        }
    }

    // 監聽客戶姓名和稱謂變化
    customerNameInput.addEventListener('input', updateNameSuffix);
    customerGenderSelect.addEventListener('change', updateNameSuffix);

    // 監聽是否需要送貨的 checkbox
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
            pickupTimeInput.setAttribute('required', 'required');
            deliveryTimeInput.removeAttribute('required');
            deliveryAddressInput.removeAttribute('required');
        }
    });

    // 提交訂單表單
    orderForm.addEventListener('submit', (event) => {
        event.preventDefault();

        // 收集訂單品項數據
        const items = [];
        let isValid = true;
        document.querySelectorAll('.order-item').forEach(itemDiv => {
            const cakeTypeSelect = itemDiv.querySelector('.cake-type');
            const cakeSizeSelect = itemDiv.querySelector('.cake-size');
            const cakeFillingSelect = itemDiv.querySelector('.cake-filling');
            const quantityInput = itemDiv.querySelector('.quantity');

            if (!cakeTypeSelect.value || !cakeSizeSelect.value || !cakeFillingSelect.value || !quantityInput.value) {
                isValid = false;
                return;
            }

            const selectedType = productOptions.cakeType.find(p => p.id === cakeTypeSelect.value);
            const selectedSize = productOptions.cakeSize.find(p => p.id === cakeSizeSelect.value);
            const selectedFilling = productOptions.cakeFilling.find(p => p.id === cakeFillingSelect.value);


            items.push({
                cakeType: {
                    id: selectedType.id,
                    name: selectedType.name,
                    price: selectedType.price
                },
                cakeSize: {
                    id: selectedSize.id,
                    name: selectedSize.name,
                    price: selectedSize.price
                },
                cakeFilling: {
                    id: selectedFilling.id,
                    name: selectedFilling.name
                },
                quantity: parseInt(quantityInput.value)
            });
        });

        if (!isValid) {
            alert('請確保所有訂單品項資訊都已填寫完整！');
            return;
        }
        if (items.length === 0) {
            alert('請至少新增一個訂單品項！');
            return;
        }

        // 收集客戶資訊
        const customerName = customerNameInput.value.trim();
        const customerPhone = document.getElementById('customerPhone').value.trim();
        const customerGender = customerGenderSelect.value;
        const paymentStatus = document.getElementById('paymentStatus').value;
        const notes = document.getElementById('notes').value.trim();
        const needsDelivery = needsDeliveryCheckbox.checked;

        let deliveryAddress = '';
        let deliveryTime = '';
        let pickupDateTime = '';

        if (needsDelivery) {
            deliveryAddress = deliveryAddressInput.value.trim();
            deliveryTime = deliveryTimeInput.value;
            if (!deliveryAddress || !deliveryTime) {
                alert('請填寫完整的送貨資訊 (地址和時間)。');
                return;
            }
        } else {
            pickupDateTime = pickupTimeInput.value;
            if (!pickupDateTime) {
                alert('請填寫完整的取貨時間。');
                return;
            }
        }

        const totalAmount = parseFloat(totalAmountDisplay.textContent);

        currentOrderData = {
            customerName,
            customerPhone,
            customerGender,
            items,
            totalAmount,
            paymentStatus,
            needsDelivery,
            deliveryAddress: needsDelivery ? deliveryAddress : null,
            deliveryTime: needsDelivery ? deliveryTime : null,
            pickupDateTime: needsDelivery ? null : pickupDateTime,
            notes
        };

        // 顯示確認模態框
        showConfirmationModal(currentOrderData);
    });

    function showConfirmationModal(orderData) {
        let itemsHtml = orderData.items.map(item => `
            <li>
                ${item.cakeType.name} (${item.cakeSize.name}) - ${item.cakeFilling.name}, 數量: ${item.quantity}
                (單價: ${item.cakeType.price + item.cakeSize.price}元)
            </li>
        `).join('');

        confirmationDetails.innerHTML = `
            <p><strong>客戶姓名:</strong> ${orderData.customerName} ${orderData.customerGender}</p>
            <p><strong>客戶電話:</strong> ${orderData.customerPhone}</p>
            <p><strong>付款狀態:</strong> ${orderData.paymentStatus}</p>
            <p><strong>總金額:</strong> ${orderData.totalAmount} 元</p>
            <h3>訂購品項:</h3>
            <ul>${itemsHtml}</ul>
            <p><strong>${orderData.needsDelivery ? '送貨地址' : '取貨時間'}:</strong> ${orderData.needsDelivery ? orderData.deliveryAddress : new Date(orderData.pickupDateTime).toLocaleString()}</p>
            ${orderData.needsDelivery ? `<p><strong>送貨抵達時間:</strong> ${new Date(orderData.deliveryTime).toLocaleString()}</p>` : ''}
            <p><strong>備註:</strong> ${orderData.notes || '無'}</p>
        `;
        orderConfirmationModal.style.display = 'block';
    }

    // 編輯按鈕：隱藏模態框，返回表單編輯
    editOrderBtn.addEventListener('click', () => {
        orderConfirmationModal.style.display = 'none';
    });

    addItemBtn.addEventListener('click', addOrderItem);

    // 初始化時載入品項選項並添加一個預設品項
    fetchProductOptions();
});