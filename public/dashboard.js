// public/dashboard.js

// 從 firebase-init.js 導入 db 物件
import { db } from './firebase-init.js';
// 導入 Firestore 相關函數
import { collection, getDocs, doc, updateDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const todayPendingOrdersSpan = document.getElementById('todayPendingOrders');
    const tomorrowDueOrdersSpan = document.getElementById('tomorrowDueOrders');
    const overdueUncompletedOrdersSpan = document.getElementById('overdueUncompletedOrders');
    const recentOrdersListDiv = document.getElementById('recentOrdersList');
    const allPendingOrdersListDiv = document.getElementById('allPendingOrdersList');

    async function fetchDashboardData() {
        recentOrdersListDiv.innerHTML = '<p>載入中...</p>';
        allPendingOrdersListDiv.innerHTML = '<p>載入中...</p>';

        try {
            // 從 Firestore 獲取所有訂單
            const querySnapshot = await getDocs(collection(db, "orders"));
            const orders = [];
            querySnapshot.forEach(doc => {
                orders.push({ id: doc.id, ...doc.data() });
            });

            const now = new Date();
            // 將時間重置到當天開始，以便精確比較日期
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            const dayAfterTomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);

            let todayPendingCount = 0;
            let tomorrowDueCount = 0;
            let overdueUncompletedCount = 0;

            const recentOrders = []; 
            const allPendingOrders = []; 

            orders.forEach(order => {
                // 過濾掉已完成或已取消的訂單
                if (order.orderStatus === '已取貨/送達' || order.orderStatus === '已取消') {
                    return;
                }

                // 將時間戳轉換為 Date 物件
                let orderDateTime = null;
                if (order.needsDelivery && order.deliveryTime) {
                    orderDateTime = new Date(order.deliveryTime);
                } else if (!order.needsDelivery && order.pickupDateTime) {
                    orderDateTime = new Date(order.pickupDateTime);
                }

                if (!orderDateTime) {
                    console.warn(`訂單 ${order.id} 沒有有效的取貨/送貨時間，將跳過處理。`);
                    return;
                }
                
                // 重置訂單日期時間到當天開始，以便日期比較
                const orderDateStart = new Date(orderDateTime.getFullYear(), orderDateTime.getMonth(), orderDateTime.getDate());

                // 計算今日待處理
                if (orderDateStart.getTime() === todayStart.getTime()) {
                    todayPendingCount++;
                    if (orderDateTime >= now) { // 只顯示尚未發生的今日訂單
                        recentOrders.push(order);
                    }
                }
                // 計算明日到期
                if (orderDateStart.getTime() === tomorrowStart.getTime()) {
                    tomorrowDueCount++;
                    recentOrders.push(order);
                }
                // 計算逾期未完成
                if (orderDateStart < todayStart) { // 日期在今天之前
                    overdueUncompletedCount++;
                }

                // 所有待處理訂單
                allPendingOrders.push(order);
            });

            todayPendingOrdersSpan.textContent = todayPendingCount;
            tomorrowDueOrdersSpan.textContent = tomorrowDueCount;
            overdueUncompletedOrdersSpan.textContent = overdueUncompletedCount;

            // 顯示近期訂單 (今日和明日的，按時間排序)
            recentOrders.sort((a, b) => {
                const timeA = a.needsDelivery ? new Date(a.deliveryTime) : new Date(a.pickupDateTime);
                const timeB = b.needsDelivery ? new Date(b.deliveryTime) : new Date(b.pickupDateTime);
                return timeA - timeB;
            });
            displayOrders(recentOrders, recentOrdersListDiv, '近期');

            // 顯示所有待處理訂單 (按時間排序)
            allPendingOrders.sort((a, b) => {
                const timeA = a.needsDelivery ? new Date(a.deliveryTime) : new Date(a.pickupDateTime);
                const timeB = b.needsDelivery ? new Date(b.deliveryTime) : new Date(b.pickupDateTime);
                return timeA - timeB;
            });
            displayOrders(allPendingOrders, allPendingOrdersListDiv, '所有待處理');

        } catch (error) {
            console.error('獲取儀表板數據失敗：', error);
            recentOrdersListDiv.innerHTML = '<p>載入數據失敗。</p>';
            allPendingOrdersListDiv.innerHTML = '<p>載入數據失敗。</p>';
        }
    }

    function displayOrders(orders, containerDiv, type) {
        if (orders.length === 0) {
            containerDiv.innerHTML = `<p>沒有${type}訂單。</p>`;
            return;
        }

        let table = `
            <table>
                <thead>
                    <tr>
                        <th>訂單ID</th>
                        <th>客戶</th>
                        <th>品項</th>
                        <th>總金額</th>
                        <th>狀態</th>
                        <th>取/送貨時間</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
        `;

        orders.forEach(order => {
            const itemSummary = order.items.map(item => `${item.cakeType.name} (${item.quantity})`).join(', ');
            const dateTime = order.needsDelivery
                ? new Date(order.deliveryTime).toLocaleString()
                : new Date(order.pickupDateTime).toLocaleString();

            table += `
                <tr>
                    <td>${order.id}</td>
                    <td>${order.customerName}</td>
                    <td>${itemSummary}</td>
                    <td>${order.totalAmount}</td>
                    <td class="order-status ${order.orderStatus.replace(/\s+/g, '-')}">${order.orderStatus}</td>
                    <td>${dateTime}</td>
                    <td>
                        <button class="edit-btn" data-id="${order.id}">編輯</button>
                        ${order.orderStatus !== '已取貨/送達' && order.orderStatus !== '已取消' ? `<button class="mark-completed-btn" data-id="${order.id}">完成</button>` : ''}
                    </td>
                </tr>
            `;
        });
        table += '</tbody></table>';
        containerDiv.innerHTML = table;

        containerDiv.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const orderId = event.target.dataset.id;
                // 跳轉到 manage.html 並帶上訂單 ID
                window.location.href = `manage.html#edit=${orderId}`; 
            });
        });

        containerDiv.querySelectorAll('.mark-completed-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const orderId = event.target.dataset.id;
                if (confirm(`確定訂單 ${orderId} 已完成取貨/送達嗎？`)) {
                    markOrderAsDelivered(orderId);
                }
            });
        });
    }

    // 函數：標記訂單為「已取貨/送達」
    async function markOrderAsDelivered(orderId) {
        try {
            const orderDocRef = doc(db, "orders", orderId);
            await updateDoc(orderDocRef, { orderStatus: '已取貨/送達' });
            
            alert('訂單已標記為「已取貨/送達」！');
            fetchDashboardData(); // 重新載入儀表板數據
        } catch (error) {
            console.error('更新訂單狀態失敗：', error);
            alert('更新訂單狀態失敗：' + error.message);
        }
    }

    // 頁面載入時執行
    fetchDashboardData();
});