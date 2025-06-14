// public/manage.js

// 從 firebase-init.js 導入 db 物件
import { db } from './firebase-init.js';
// 導入 Firestore 相關函數
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, where } from "firebase/firestore";

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
    const editNotesInput = document.getElementById('editNotes');
    const editDeliveryAddressInput = document.getElementById('editDeliveryAddress');


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
            console.log("品項選項載入成功 (管理頁面):", productOptions);
        } catch (error) {
            console.error('獲取品項選項失敗 (管理頁面)：', error);
            alert('載入品項時發生錯誤，請稍後再試。');
        }
    }


    // 函數：從 Firestore 獲取並顯示所有訂單
    async function fetchAndDisplayOrders() {
        orderListContainer.innerHTML = '<p>載入訂單中...</p>'; // 顯示載入狀態
        try {
            // 查詢所有訂單，可以根據 createdAt 排序
            const ordersCollectionRef = collection(db, "orders");
            const q = query(ordersCollectionRef, orderBy("createdAt", "desc")); // 根據創建時間降序排列

            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                orderListContainer.innerHTML = '<p>目前沒有任何訂單。</p>';
                return;
            }

            let ordersHtml = '<table><thead><tr><th>ID</th><th>建立時間</th><th>客戶</th><th>電話</th><th>總金額</th><th>取貨/送貨時間</th><th>狀態</th><th>操作</th></tr></thead><tbody>';
            querySnapshot.forEach(doc => {
                const order = { id: doc.id, ...doc.data() };
                
                // 將 Firestore Timestamp 轉換為 JavaScript Date 對象
                const createdAt = order.createdAt ? order.createdAt.toDate().toLocaleString() : 'N/A';
                const pickupOrDeliveryTime = order.needsDelivery && order.deliveryTime
                    ? order.deliveryTime.toDate().toLocaleString()
                    : (order.pickupDateTime ? order.pickupDateTime.toDate().toLocaleString() : 'N/A');

                ordersHtml += `
                    <tr>
                        <td>${order.displayId || order.id.substring(0, 6).toUpperCase()}</td>
                        <td>${createdAt}</td>
                        <td>${order.customerName} ${order.customerGender || ''}</td>
                        <td>${order.customerPhone}</td>
                        <td>${order.totalAmount}</td>
                        <td>${pickupOrDeliveryTime}</td>
                        <td>${order.orderStatus}</td>
                        <td>
                            <button class="edit-btn" data-id="${order.id}">編輯</button>
                            <button class="delete-btn" data-id="${order.id}">刪除</button>
                            ${order.orderStatus !== '已取貨/送達' ? `<button class="complete-btn" data-id="${order.id}">完成</button>` : ''}
                            <button class="print-btn" data-id="${order.id}">列印</button>
                        </td>
                    </tr>
                `;
            });
            ordersHtml += '</tbody></table>';
            orderListContainer.innerHTML = ordersHtml;

            // 綁定事件監聽器
            document.querySelectorAll('.edit-btn').forEach(button => {
                button.addEventListener('click', (event) => editOrder(event.target.dataset.id));
            });
            document.querySelectorAll('.delete-btn').forEach(button => {
                button.addEventListener('click', (event) => deleteOrder(event.target.dataset.id));
            });
            document.querySelectorAll('.complete-btn').forEach(button => {
                button.addEventListener('click', (event) => markOrderAsCompleted(event.target.dataset.id));
            });
            document.querySelectorAll('.print-btn').forEach(button => {
                button.addEventListener('click', (event) => printOrder(event.target.dataset.id));
            });

        } catch (error) {
            console.error("獲取訂單失敗：", error);
            orderListContainer.innerHTML = '<p>載入訂單失敗，請稍後再試。</p>';
        }
    }

    // 函數：編輯訂單
    async function editOrder(orderId) {
        currentEditingOrderId = orderId;
        try {
            const orderDocRef = doc(db, "orders", orderId);
            const orderDoc = await getDocs(orderDocRef); // 使用 getDocs 獲取單個文檔快照

            if (!orderDoc.exists()) {
                alert('找不到該訂單。');
                return;
            }

            const order = orderDoc.data();
            editOrderIdDisplay.textContent = order.displayId || order.id.substring(0, 6).toUpperCase();

            // 填充表單
            editCustomerNameInput.value = order.customerName || '';
            editCustomerGenderSelect.value = order.customerGender || '先生';
            document.getElementById('editCustomerPhone').value = order.customerPhone || '';
            editPaymentStatusSelect.value = order.paymentStatus || '未付款';
            editNotesInput.value = order.notes || '';
            editOrderStatusSelect.value = order.orderStatus || '待處理';

            editNeedsDeliveryCheckbox.checked = order.needsDelivery || false;
            editDeliveryAddressInput.value = order.deliveryAddress || '';

            // 處理日期時間
            if (order.needsDelivery && order.deliveryTime) {
                editDeliveryTimeInput.value = order.deliveryTime.toDate().toISOString().slice(0, 16);
                editDeliveryInfoDiv.style.display = 'block';
                editPickupInfoDiv.style.display = 'none';
            } else if (order.pickupDateTime) {
                editPickupTimeInput.value = order.pickupDateTime.toDate().toISOString().slice(0, 16);
                editDeliveryInfoDiv.style.display = 'none';
                editPickupInfoDiv.style.display = 'block';
            } else {
                // 如果都沒有，預設顯示取貨資訊
                editDeliveryInfoDiv.style.display = 'none';
                editPickupInfoDiv.style.display = 'block';
                editPickupTimeInput.value = ''; // 清空時間
            }

            // 更新編輯訂單中的品項列表
            const editOrderItemsContainer = document.getElementById('editOrderItemsContainer');
            editOrderItemsContainer.innerHTML = '<h3>蛋糕品項</h3>'; // 清空舊品項
            let totalAmountInEdit = 0;

            order.items.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('order-item');
                itemDiv.dataset.index = index; // 用於後續識別

                const selectedCakeType = productOptions.cakeType.find(p => p.id === item.cakeType.id);
                const selectedCakeSize = productOptions.cakeSize.find(p => p.id === item.cakeSize.id);
                const selectedCakeFilling = productOptions.cakeFilling.find(p => p.id === item.cakeFilling.id);

                const typePrice = selectedCakeType ? selectedCakeType.price : 0;
                const sizePrice = selectedCakeSize ? selectedCakeSize.price : 0;
                totalAmountInEdit += (typePrice + sizePrice) * item.quantity;

                itemDiv.innerHTML = `
                    <label>蛋糕種類：</label>
                    <select class="edit-cake-type" data-index="${index}" required>
                        ${productOptions.cakeType.map(type => 
                            `<option value="${type.id}" ${type.id === item.cakeType.id ? 'selected' : ''} data-price="${type.price}">${type.name}</option>`
                        ).join('')}
                    </select><br><br>

                    <label>尺寸：</label>
                    <select class="edit-cake-size" data-index="${index}" required>
                        ${productOptions.cakeSize.map(size => 
                            `<option value="${size.id}" ${size.id === item.cakeSize.id ? 'selected' : ''} data-price="${size.price}">${size.name}</option>`
                        ).join('')}
                    </select><br><br>

                    <label>餡料：</label>
                    <select class="edit-cake-filling" data-index="${index}" required>
                        ${productOptions.cakeFilling.map(filling => 
                            `<option value="${filling.id}" ${filling.id === item.cakeFilling.id ? 'selected' : ''}>${filling.name}</option>`
                        ).join('')}
                    </select><br><br>

                    <label>數量：</label>
                    <input type="number" class="edit-quantity" value="${item.quantity}" min="1" data-index="${index}" required><br><br>
                `;
                editOrderItemsContainer.appendChild(itemDiv);

                // 為編輯框中的品項綁定事件監聽器，以便計算總金額
                itemDiv.querySelectorAll('.edit-cake-type, .edit-cake-size, .edit-quantity').forEach(element => {
                    element.addEventListener('change', calculateEditTotalAmount);
                    element.addEventListener('input', calculateEditTotalAmount);
                });
            });

            editTotalAmountDisplay.textContent = totalAmountInEdit;

            // 監聽編輯模態框中的送貨 checkbox
            editNeedsDeliveryCheckbox.addEventListener('change', () => {
                if (editNeedsDeliveryCheckbox.checked) {
                    editDeliveryInfoDiv.style.display = 'block';
                    editPickupInfoDiv.style.display = 'none';
                    editDeliveryTimeInput.setAttribute('required', 'required');
                    editDeliveryAddressInput.setAttribute('required', 'required');
                    editPickupTimeInput.removeAttribute('required');
                } else {
                    editDeliveryInfoDiv.style.display = 'none';
                    editPickupInfoDiv.style.display = 'block';
                    editPickupTimeInput.setAttribute('required', 'required');
                    editDeliveryTimeInput.removeAttribute('required');
                    editDeliveryAddressInput.removeAttribute('required');
                }
            });

            editOrderModal.style.display = 'block'; // 顯示編輯模態框

        } catch (error) {
            console.error("獲取訂單詳情失敗：", error);
            alert("獲取訂單詳情失敗：" + error.message);
        }
    }

    // 計算編輯時的總金額
    function calculateEditTotalAmount() {
        let total = 0;
        document.querySelectorAll('#editOrderItemsContainer .order-item').forEach(itemDiv => {
            const cakeTypeSelect = itemDiv.querySelector('.edit-cake-type');
            const cakeSizeSelect = itemDiv.querySelector('.edit-cake-size');
            const quantityInput = itemDiv.querySelector('.edit-quantity');

            const selectedTypeOption = cakeTypeSelect.options[cakeTypeSelect.selectedIndex];
            const selectedSizeOption = cakeSizeSelect.options[cakeSizeSelect.selectedIndex];

            const typePrice = selectedTypeOption && selectedTypeOption.dataset.price ? parseFloat(selectedTypeOption.dataset.price) : 0;
            const sizePrice = selectedSizeOption && selectedSizeOption.dataset.price ? parseFloat(selectedSizeOption.dataset.price) : 0;
            const quantity = parseInt(quantityInput.value) || 0;

            if (typePrice > 0 && sizePrice > 0 && quantity > 0) {
                total += (typePrice + sizePrice) * quantity;
            }
        });
        editTotalAmountDisplay.textContent = total;
    }


    // 函數：儲存編輯後的訂單
    editOrderForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const updatedItems = [];
        let isValid = true;
        document.querySelectorAll('#editOrderItemsContainer .order-item').forEach(itemDiv => {
            const cakeTypeSelect = itemDiv.querySelector('.edit-cake-type');
            const cakeSizeSelect = itemDiv.querySelector('.edit-cake-size');
            const cakeFillingSelect = itemDiv.querySelector('.edit-cake-filling');
            const quantityInput = itemDiv.querySelector('.edit-quantity');

            if (!cakeTypeSelect.value || !cakeSizeSelect.value || !cakeFillingSelect.value || !quantityInput.value) {
                isValid = false;
                return;
            }

            const selectedType = productOptions.cakeType.find(p => p.id === cakeTypeSelect.value);
            const selectedSize = productOptions.cakeSize.find(p => p.id === cakeSizeSelect.value);
            const selectedFilling = productOptions.cakeFilling.find(p => p.id === cakeFillingSelect.value);

            updatedItems.push({
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

        const updatedData = {
            customerName: editCustomerNameInput.value.trim(),
            customerPhone: document.getElementById('editCustomerPhone').value.trim(),
            customerGender: editCustomerGenderSelect.value,
            paymentStatus: editPaymentStatusSelect.value,
            notes: editNotesInput.value.trim(),
            orderStatus: editOrderStatusSelect.value,
            needsDelivery: editNeedsDeliveryCheckbox.checked,
            totalAmount: parseFloat(editTotalAmountDisplay.textContent),
            items: updatedItems
        };

        // 處理日期時間
        if (updatedData.needsDelivery) {
            updatedData.deliveryAddress = editDeliveryAddressInput.value.trim();
            updatedData.deliveryTime = editDeliveryTimeInput.value ? new Date(editDeliveryTimeInput.value) : null;
            updatedData.pickupDateTime = null; // 清空取貨時間
            if (!updatedData.deliveryAddress || !updatedData.deliveryTime) {
                alert('請填寫完整的送貨資訊 (地址和時間)。');
                return;
            }
        } else {
            updatedData.pickupDateTime = editPickupTimeInput.value ? new Date(editPickupTimeInput.value) : null;
            updatedData.deliveryAddress = null; // 清空送貨地址
            updatedData.deliveryTime = null; // 清空送貨時間
            if (!updatedData.pickupDateTime) {
                alert('請填寫完整的取貨時間。');
                return;
            }
        }

        try {
            const orderDocRef = doc(db, "orders", currentEditingOrderId);
            await updateDoc(orderDocRef, updatedData);
            
            alert('訂單更新成功！');
            editOrderModal.style.display = 'none'; // 隱藏 Modal
            fetchAndDisplayOrders(); // 重新載入訂單列表
        } catch (error) {
            console.error('更新訂單失敗：', error);
            alert('更新訂單失敗：' + error.message);
        }
    });

    // 取消編輯
    cancelEditBtn.addEventListener('click', () => {
        editOrderModal.style.display = 'none';
    });

    // 函數：刪除訂單
    async function deleteOrder(orderId) {
        if (confirm('確定要刪除這筆訂單嗎？此操作無法復原。')) {
            try {
                const orderDocRef = doc(db, "orders", orderId);
                await deleteDoc(orderDocRef);
                alert('訂單刪除成功！');
                fetchAndDisplayOrders(); // 重新載入訂單列表
            } catch (error) {
                console.error('刪除訂單失敗：', error);
                alert('刪除訂單失敗：' + error.message);
            }
        }
    }

    // 函數：標記訂單為「已完成」 (已取貨/送達)
    async function markOrderAsCompleted(orderId) {
        if (confirm(`確定訂單 ${orderId} 已完成取貨/送達嗎？`)) {
            try {
                const orderDocRef = doc(db, "orders", orderId);
                await updateDoc(orderDocRef, { orderStatus: '已取貨/送達' });
                alert('訂單狀態已更新為「已取貨/送達」！');
                fetchAndDisplayOrders(); // 重新載入訂單列表
            } catch (error) {
                console.error('更新訂單狀態失敗：', error);
                alert('更新訂單狀態失敗：' + error.message);
            }
        }
    }

    // 函數：列印訂單
    async function printOrder(orderId) {
        try {
            const orderDocRef = doc(db, "orders", orderId);
            const orderDoc = await getDocs(orderDocRef);

            if (!orderDoc.exists()) {
                alert('找不到該訂單。');
                return;
            }
            const orderToPrint = orderDoc.data();

            // 格式化日期和時間
            const createdAt = orderToPrint.createdAt ? orderToPrint.createdAt.toDate().toLocaleString() : 'N/A';
            const pickupOrDeliveryDateTime = orderToPrint.needsDelivery && orderToPrint.deliveryTime
                ? orderToPrint.deliveryTime.toDate().toLocaleString()
                : (orderToPrint.pickupDateTime ? orderToPrint.pickupDateTime.toDate().toLocaleString() : 'N/A');

            let itemsHtml = orderToPrint.items.map((item, index) => `
                <li>
                    ${index + 1}. 蛋糕種類: ${item.cakeType.name}, 尺寸: ${item.cakeSize.name}, 餡料: ${item.cakeFilling.name}, 數量: ${item.quantity} 個
                    ${item.cakeType.price && item.cakeSize.price ? `(單價: ${item.cakeType.price + item.cakeSize.price}元)` : ''}
                </li>
            `).join('');

            const printContent = `
                <h1>鳳城麵包店 - 訂單出貨單</h1>
                <p><strong>訂單號碼:</strong> ${orderToPrint.displayId || orderToPrint.id.substring(0, 6).toUpperCase()}</p>
                <p><strong>建立時間:</strong> ${createdAt}</p>
                <h3>客戶資訊</h3>
                <p><strong>客戶姓名:</strong> ${orderToPrint.customerName} ${orderToPrint.customerGender || ''}</p>
                <p><strong>客戶電話:</strong> ${orderToPrint.customerPhone}</p>
                <p><strong>送貨/取貨方式:</strong> ${orderToPrint.needsDelivery ? '送貨' : '自取'}</p>
                ${orderToPrint.needsDelivery ? `<p><strong>送貨地址:</strong> ${orderToPrint.deliveryAddress || '無'}</p>` : ''}
                <p><strong>預計取貨/送達時間:</strong> ${pickupOrDeliveryDateTime}</p>
                <h3>訂單明細</h3>
                <ul>${itemsHtml}</ul>
                <p><strong>總金額:</strong> ${orderToPrint.totalAmount} 元</p>
                <p><strong>付款狀態:</strong> ${orderToPrint.paymentStatus}</p>
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
        } else {
            editDeliveryInfoDiv.style.display = 'none';
            editPickupInfoDiv.style.display = 'block';
        }
    });
});