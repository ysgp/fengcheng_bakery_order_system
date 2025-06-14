// public/manage.js

// 從 firebase-init.js 導入 db 物件
import { db } from './firebase-init.js';
// 導入 Firestore 相關函數
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const orderListContainer = document.getElementById('orderListContainer');
    const editOrderModal = document.getElementById('editOrderModal');
    const editOrderForm = document.getElementById('editOrderForm');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const editOrderIdDisplay = document.getElementById('editOrderIdDisplay');
    const editTotalAmountDisplay = document.getElementById('editTotalAmountDisplay'); // 新增編輯時的總金額顯示

    const editNeedsDeliveryCheckbox = document.getElementById('editNeedsDelivery');
    const editDeliveryInfoDiv = document.getElementById('editDeliveryInfo');
    const editPickupInfoDiv = document.getElementById('editPickupInfo');
    const editDeliveryTimeInput = document.getElementById('editDeliveryTime');
    const editPickupTimeInput = document.getElementById('editPickupTime');
    const editCustomerNameInput = document.getElementById('editCustomerName');
    const editCustomerGenderSelect = document.getElementById('editCustomerGender');
    const editPaymentStatusSelect = document.getElementById('editPaymentStatus'); // 獲取付款狀態選擇器
    const editOrderStatusSelect = document.getElementById('editOrderStatus'); // 訂單狀態選擇器

    // 從 Firestore 獲取品項選項 (包含價格資訊)
    let productOptions = {
        cakeType: [],
        cakeSize: [],
        cakeFilling: []
    };

    let currentEditingOrderId = null; 

    // 獲取品項選項
    async function fetchProductOptionsForManage() {
        try {
            const productsSnapshot = await getDocs(collection(db, "products"));
            productOptions = { // 重置
                cakeType: [],
                cakeSize: [],
                cakeFilling: []
            };
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
        } catch (error) {
            console.error('獲取品項選項失敗：', error);
            alert('無法載入品項選項，請檢查網路連線或稍後再試。');
        }
    }

    // 函數：動態計算總金額（編輯模式）
    function calculateEditTotalAmount() {
        let total = 0;
        document.querySelectorAll('#editOrderItemsContainer .order-item-edit').forEach(itemDiv => {
            const cakeTypeId = itemDiv.querySelector('.edit-cake-type-select').value;
            const cakeSizeId = itemDiv.querySelector('.edit-cake-size-select').value;
            const quantity = parseInt(itemDiv.querySelector('.edit-quantity-input').value) || 0;

            const selectedCakeType = productOptions.cakeType.find(type => type.id === cakeTypeId);
            const selectedCakeSize = productOptions.cakeSize.find(size => size.id === cakeSizeId);

            if (selectedCakeType && selectedCakeSize) {
                total += (selectedCakeType.price + selectedCakeSize.price) * quantity;
            }
        });
        editTotalAmountDisplay.textContent = total;
    }


    // 函數：從 Firestore 獲取並顯示所有訂單
    async function fetchAndDisplayOrders() {
        orderListContainer.innerHTML = '<p>載入訂單中...</p>'; // 顯示載入訊息

        try {
            // 從 Firestore 獲取所有訂單，並按照建立時間倒序排序
            const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            const orders = [];
            querySnapshot.forEach(doc => {
                orders.push({ id: doc.id, ...doc.data() });
            });

            if (orders.length === 0) {
                orderListContainer.innerHTML = '<p>目前沒有訂單。</p>';
                return;
            }

            let tableHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>訂單ID</th>
                            <th>客戶姓名</th>
                            <th>電話</th>
                            <th>總金額</th>
                            <th>付款狀態</th>
                            <th>取/送貨時間</th>
                            <th>訂單狀態</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            orders.forEach(order => {
                const dateTime = order.needsDelivery
                    ? new Date(order.deliveryTime).toLocaleString()
                    : new Date(order.pickupDateTime).toLocaleString();

                tableHTML += `
                    <tr>
                        <td>${order.id}</td>
                        <td>${order.customerName} ${order.customerGender || ''}</td>
                        <td>${order.customerPhone}</td>
                        <td>${order.totalAmount}</td>
                        <td>${order.paymentStatus}</td>
                        <td>${dateTime}</td>
                        <td class="order-status ${order.orderStatus.replace(/\s+/g, '-')}">${order.orderStatus}</td>
                        <td>
                            <button class="edit-btn" data-id="${order.id}">編輯</button>
                            <button class="delete-btn" data-id="${order.id}">刪除</button>
                            ${order.orderStatus === '已完成' || order.orderStatus === '已取貨/送達' ? `<button class="print-btn" data-id="${order.id}">列印</button>` : ''}
                            ${order.orderStatus === '已完成' && order.needsDelivery ? `<button class="mark-delivered-btn" data-id="${order.id}">標記已送達</button>` : ''}
                            ${order.orderStatus === '已完成' && !order.needsDelivery ? `<button class="mark-pickedup-btn" data-id="${order.id}">標記已取貨</button>` : ''}

                        </td>
                    </tr>
                `;
            });

            tableHTML += `
                    </tbody>
                </table>
            `;
            orderListContainer.innerHTML = tableHTML;

            // 為按鈕添加事件監聽器
            document.querySelectorAll('.edit-btn').forEach(button => {
                button.addEventListener('click', (event) => {
                    editOrder(event.target.dataset.id);
                });
            });
            document.querySelectorAll('.delete-btn').forEach(button => {
                button.addEventListener('click', (event) => {
                    deleteOrder(event.target.dataset.id);
                });
            });
            document.querySelectorAll('.print-btn').forEach(button => {
                button.addEventListener('click', (event) => {
                    printOrder(event.target.dataset.id);
                });
            });
            document.querySelectorAll('.mark-delivered-btn, .mark-pickedup-btn').forEach(button => {
                button.addEventListener('click', (event) => {
                    const orderId = event.target.dataset.id;
                    if (confirm(`確定訂單 ${orderId} 已完成${event.target.classList.contains('mark-delivered-btn') ? '送達' : '取貨'}嗎？`)) {
                        markOrderAsCompleted(orderId);
                    }
                });
            });

        } catch (error) {
            console.error('獲取訂單失敗：', error);
            orderListContainer.innerHTML = '<p>載入訂單失敗，請檢查網路連線或稍後再試。</p>';
        }
    }

    // 函數：編輯訂單
    async function editOrder(orderId) {
        currentEditingOrderId = orderId; // 儲存當前編輯的訂單ID
        try {
            // 從 Firestore 獲取單個訂單資料
            const orderDoc = await doc(db, "orders", orderId).get();
            if (!orderDoc.exists) {
                alert('訂單不存在！');
                return;
            }
            const order = { id: orderDoc.id, ...orderDoc.data() };

            editOrderIdDisplay.textContent = order.id;
            editCustomerNameInput.value = order.customerName;
            editCustomerGenderSelect.value = order.customerGender;
            editCustomerPhone.value = order.customerPhone;
            editPaymentStatusSelect.value = order.paymentStatus;
            editNeedsDeliveryCheckbox.checked = order.needsDelivery;
            editNotes.value = order.notes || '';
            editOrderStatusSelect.value = order.orderStatus; // 設置訂單狀態

            // 處理送貨/取貨資訊的顯示
            if (order.needsDelivery) {
                editDeliveryInfoDiv.style.display = 'block';
                editPickupInfoDiv.style.display = 'none';
                editDeliveryAddress.value = order.deliveryAddress || '';
                editDeliveryTimeInput.value = order.deliveryTime ? new Date(order.deliveryTime).toISOString().slice(0, 16) : '';
                editPickupTimeInput.removeAttribute('required');
                editDeliveryTimeInput.setAttribute('required', 'required');
                editDeliveryAddress.setAttribute('required', 'required');

            } else {
                editDeliveryInfoDiv.style.display = 'none';
                editPickupInfoDiv.style.display = 'block';
                editPickupTimeInput.value = order.pickupDateTime ? new Date(order.pickupDateTime).toISOString().slice(0, 16) : '';
                editDeliveryTimeInput.removeAttribute('required');
                editDeliveryAddress.removeAttribute('required');
                editPickupTimeInput.setAttribute('required', 'required');
            }

            // 清空舊品項並渲染新品項
            const editOrderItemsContainer = document.getElementById('editOrderItemsContainer');
            editOrderItemsContainer.innerHTML = '<h3>蛋糕品項</h3>'; // 保持標題

            order.items.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('order-item-edit');
                itemDiv.innerHTML = `
                    <h4>品項 ${index + 1}</h4>
                    <label for="editCakeType${index}">蛋糕種類：</label>
                    <select id="editCakeType${index}" class="edit-cake-type-select" required>
                        <option value="">請選擇蛋糕種類</option>
                        ${productOptions.cakeType.map(type => `<option value="${type.id}" ${type.id === item.cakeType.id ? 'selected' : ''}>${type.name}</option>`).join('')}
                    </select><br><br>

                    <label for="editCakeSize${index}">尺寸：</label>
                    <select id="editCakeSize${index}" class="edit-cake-size-select" required>
                        <option value="">請選擇尺寸</option>
                        ${productOptions.cakeSize.map(size => `<option value="${size.id}" ${size.id === item.cakeSize.id ? 'selected' : ''}>${size.name}</option>`).join('')}
                    </select><br><br>

                    <label for="editCakeFilling${index}">餡料：</label>
                    <select id="editCakeFilling${index}" class="edit-cake-filling-select" required>
                        <option value="">請選擇餡料</option>
                        ${productOptions.cakeFilling.map(filling => `<option value="${filling.id}" ${filling.id === item.cakeFilling.id ? 'selected' : ''}>${filling.name}</option>`).join('')}
                    </select><br><br>

                    <label for="editQuantity${index}">數量：</label>
                    <input type="number" id="editQuantity${index}" class="edit-quantity-input" min="1" value="${item.quantity}" required><br><br>
                `;
                editOrderItemsContainer.appendChild(itemDiv);

                // 綁定事件監聽器以重新計算總金額
                itemDiv.querySelectorAll('select, input[type="number"]').forEach(element => {
                    element.addEventListener('change', calculateEditTotalAmount);
                    element.addEventListener('input', calculateEditTotalAmount);
                });
            });

            calculateEditTotalAmount(); // 初次計算總金額
            editOrderModal.style.display = 'block'; // 顯示 Modal
            
            // 處理 URL hash 移除 #edit 參數
            if (window.location.hash.startsWith('#edit=')) {
                history.replaceState(null, null, ' '); // 移除 hash
            }

        } catch (error) {
            console.error('獲取訂單詳情失敗：', error);
            alert('載入訂單詳情失敗，請檢查網路連線或稍後再試。');
        }
    }

    // 編輯表單提交事件
    editOrderForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const updatedItems = [];
        let isValid = true;
        document.querySelectorAll('#editOrderItemsContainer .order-item-edit').forEach(itemDiv => {
            const cakeTypeId = itemDiv.querySelector('.edit-cake-type-select').value;
            const cakeSizeId = itemDiv.querySelector('.edit-cake-size-select').value;
            const cakeFillingId = itemDiv.querySelector('.edit-cake-filling-select').value;
            const quantity = parseInt(itemDiv.querySelector('.edit-quantity-input').value);

            const selectedCakeType = productOptions.cakeType.find(type => type.id === cakeTypeId);
            const selectedCakeSize = productOptions.cakeSize.find(size => size.id === cakeSizeId);
            const selectedCakeFilling = productOptions.cakeFilling.find(filling => filling.id === cakeFillingId);

            if (!selectedCakeType || !selectedCakeSize || !selectedCakeFilling || isNaN(quantity) || quantity <= 0) {
                isValid = false;
                alert('請確保所有蛋糕品項都已選擇且數量有效。');
                return;
            }

            updatedItems.push({
                cakeType: { id: selectedCakeType.id, name: selectedCakeType.name, price: selectedCakeType.price },
                cakeSize: { id: selectedCakeSize.id, name: selectedCakeSize.name, price: selectedCakeSize.price },
                cakeFilling: { id: selectedCakeFilling.id, name: selectedCakeFilling.name },
                quantity: quantity
            });
        });

        if (!isValid) return;

        const updatedData = {
            customerName: editCustomerNameInput.value.trim(),
            customerGender: editCustomerGenderSelect.value,
            customerPhone: editCustomerPhone.value.trim(),
            paymentStatus: editPaymentStatusSelect.value,
            needsDelivery: editNeedsDeliveryCheckbox.checked,
            notes: editNotes.value.trim(),
            orderStatus: editOrderStatusSelect.value,
            totalAmount: parseFloat(editTotalAmountDisplay.textContent),
            items: updatedItems
        };

        if (updatedData.needsDelivery) {
            updatedData.deliveryAddress = editDeliveryAddress.value.trim();
            updatedData.deliveryTime = editDeliveryTimeInput.value ? new Date(editDeliveryTimeInput.value).toISOString() : null;
            updatedData.pickupDateTime = null; // 清空取貨時間
            if (!updatedData.deliveryAddress || !updatedData.deliveryTime) {
                alert('請填寫完整的送貨資訊。');
                return;
            }
        } else {
            updatedData.pickupDateTime = editPickupTimeInput.value ? new Date(editPickupTimeInput.value).toISOString() : null;
            updatedData.deliveryAddress = ''; // 清空送貨地址
            updatedData.deliveryTime = null; // 清空送貨時間
            if (!updatedData.pickupDateTime) {
                alert('請填寫取貨時間。');
                return;
            }
        }

        // 檢查日期是否在未來
        const now = new Date();
        now.setSeconds(0,0);
        let targetTime = updatedData.needsDelivery ? new Date(updatedData.deliveryTime) : new Date(updatedData.pickupDateTime);
        if (targetTime && targetTime <= now && updatedData.orderStatus !== '已取貨/送達' && updatedData.orderStatus !== '已取消') {
            alert((updatedData.needsDelivery ? '送貨抵達時間' : '取貨時間') + '必須是未來的時間，除非訂單狀態為「已取貨/送達」或「已取消」。');
            return;
        }

        try {
            // 更新 Firestore 中的訂單
            const orderDocRef = doc(db, "orders", currentEditingOrderId);
            await updateDoc(orderDocRef, updatedData);
            
            alert('訂單更新成功！');
            editOrderModal.style.display = 'none'; // 隱藏 Modal
            fetchAndDisplayOrders(); // 重新載入訂單列表
        } catch (error) {
            console.error('更新訂單錯誤：', error);
            alert('更新訂單失敗：' + error.message);
        }
    });

    // 取消編輯按鈕
    cancelEditBtn.addEventListener('click', () => {
        editOrderModal.style.display = 'none';
    });

    // 函數：刪除訂單
    async function deleteOrder(orderId) {
        if (confirm('確定要刪除這個訂單嗎？此操作無法復原。')) {
            try {
                // 從 Firestore 刪除訂單
                await deleteDoc(doc(db, "orders", orderId));
                alert('訂單刪除成功！');
                fetchAndDisplayOrders(); // 重新載入訂單列表
            } catch (error) {
                console.error('刪除訂單失敗：', error);
                alert('刪除訂單失敗：' + error.message);
            }
        }
    }

    // 函數：標記訂單為「已取貨/送達」
    async function markOrderAsCompleted(orderId) {
        try {
            // 更新 Firestore 中的訂單狀態
            const orderDocRef = doc(db, "orders", orderId);
            await updateDoc(orderDocRef, { orderStatus: '已取貨/送達' });
            
            alert('訂單狀態已更新為「已取貨/送達」！');
            fetchAndDisplayOrders(); // 重新載入訂單列表
        } catch (error) {
            console.error('更新訂單狀態失敗：', error);
            alert('更新訂單狀態失敗：' + error.message);
        }
    }


    // 函數：列印訂單
    async function printOrder(orderId) {
        try {
            // 從 Firestore 獲取訂單資料
            const orderDoc = await doc(db, "orders", orderId).get();
            if (!orderDoc.exists) {
                alert('訂單不存在，無法列印！');
                return;
            }
            const orderToPrint = { id: orderDoc.id, ...orderDoc.data() };

            let itemsHtml = orderToPrint.items.map(item => `
                <li>
                    ${item.cakeType.name} (${item.cakeSize.name}) - ${item.cakeFilling.name}, 數量: ${item.quantity}
                    (單價: ${item.cakeType.price + item.cakeSize.price}元)
                </li>
            `).join('');

            const dateTimeLabel = orderToPrint.needsDelivery ? '送貨抵達時間' : '取貨時間';
            const dateTimeValue = orderToPrint.needsDelivery
                ? (orderToPrint.deliveryTime ? new Date(orderToPrint.deliveryTime).toLocaleString() : '未設定')
                : (orderToPrint.pickupDateTime ? new Date(orderToPrint.pickupDateTime).toLocaleString() : '未設定');
            const addressInfo = orderToPrint.needsDelivery ? `<p><strong>送貨地址:</strong> ${orderToPrint.deliveryAddress || '未設定'}</p>` : '';


            const printContent = `
                <h1>鳳城麵包店 - 出貨單</h1>
                <p><strong>訂單ID:</strong> ${orderToPrint.id}</p>
                <p><strong>客戶姓名:</strong> ${orderToPrint.customerName} ${orderToPrint.customerGender || ''}</p>
                <p><strong>客戶電話:</strong> ${orderToPrint.customerPhone}</p>
                ${addressInfo}
                <p><strong>${dateTimeLabel}:</strong> ${dateTimeValue}</p>
                <p><strong>付款狀態:</strong> ${orderToPrint.paymentStatus}</p>
                <h3>訂購品項:</h3>
                <ul>${itemsHtml}</ul>
                <p><strong>總金額:</strong> ${orderToPrint.totalAmount} 元</p>
                <p><strong>備註:</strong> ${orderToPrint.notes || '無'}</p>
                <p><strong>訂單狀態:</strong> ${orderToPrint.orderStatus}</p>
                <br><br>
                <p>------------------ 謝謝惠顧！ ------------------</p>
            `;

            const printWindow = window.open('', '_blank');
            printWindow.document.write('<html><head><title>出貨單</title>');
            printWindow.document.write('<style>');
            printWindow.document.write(`
                body { font-family: '微軟正黑體', 'Arial', sans-serif; margin: 20px; }
                h1 { text-align: center; color: #333; }
                h3 { border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 20px; }
                p, ul { margin-bottom: 5px; }
                ul { list-style: none; padding-left: 0; }
                li { margin-bottom: 3px; }
                @media print {
                    button { display: none; }
                }
            `);
            printWindow.document.write('</style>');
            printWindow.document.write('</head><body>');
            printWindow.document.write(printContent);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.print(); 

        } catch (error) {
            console.error('列印訂單失敗：', error);
            alert('列印訂單失敗：' + error.message);
        }
    }


    // 頁面載入時執行
    fetchProductOptionsForManage().then(() => {
        fetchAndDisplayOrders(); // 確保品項載入後再顯示訂單
        // 檢查 URL 中是否有 #edit=orderId 參數
        const hash = window.location.hash;
        if (hash.startsWith('#edit=')) {
            const orderIdFromUrl = hash.substring(6);
            editOrder(orderIdFromUrl);
        }
    });

    // 監聽編輯模態框中的送貨 checkbox 的變化
    editNeedsDeliveryCheckbox.addEventListener('change', () => {
        if (editNeedsDeliveryCheckbox.checked) {
            editDeliveryInfoDiv.style.display = 'block';
            editPickupInfoDiv.style.display = 'none';
            editDeliveryTimeInput.setAttribute('required', 'required');
            editDeliveryAddress.setAttribute('required', 'required');
            editPickupTimeInput.removeAttribute('required');
        } else {
            editDeliveryInfoDiv.style.display = 'none';
            editPickupInfoDiv.style.display = 'block';
            editDeliveryTimeInput.removeAttribute('required');
            editDeliveryAddress.removeAttribute('required');
            editPickupTimeInput.setAttribute('required', 'required');
        }
    });

});