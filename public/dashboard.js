// public/dashboard.js

// 從 firebase-init.js 導入 db 物件
import { db } from './firebase-init.js';
// 導入 Firestore 相關函數
import { collection, getDocs, doc, updateDoc, query, where, orderBy } from "firebase/firestore";

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

            const recentOrders = []; // 今日和明日的訂單
            const allPendingOrders = []; // 所有待處理、製作中、已完成但未取/送達的訂單

            orders.forEach(order => {
                // 將 Firestore Timestamp 轉換為 JavaScript Date 對象
                const pickupOrDeliveryDate = order.needsDelivery && order.deliveryTime
                    ? order.deliveryTime.toDate()
                    : (order.pickupDateTime ? order.pickupDateTime.toDate() : null);

                // 只考慮未完成或未取消的訂單
                if (order.orderStatus === '已取貨/送達' || order.orderStatus === '已取消') {
                    return;
                }

                allPendingOrders.push(order); // 將所有未完成訂單加入列表

                if (pickupOrDeliveryDate) {
                    const orderDate = new Date(pickupOrDeliveryDate.getFullYear(), pickupOrDeliveryDate.getMonth(), pickupOrDeliveryDate.getDate());

                    // 今日待處理
                    if (orderDate.getTime() === todayStart.getTime()) {
                        todayPendingCount++;
                        recentOrders.push(order);
                    }
                    // 明日到期
                    else if (orderDate.getTime() === tomorrowStart.getTime()) {
                        tomorrowDueCount++;
                        recentOrders.push(order);
                    }
                    // 逾期未完成
                    else if (orderDate.getTime() < todayStart.getTime()) {
                        overdueUncompletedCount++;
                    }
                }
            });

            todayPendingOrdersSpan.textContent = todayPendingCount;
            tomorrowDueOrdersSpan.textContent = tomorrowDueCount;
            overdueUncompletedOrdersSpan.textContent = overdueUncompletedCount;

            displayOrders(recentOrders, recentOrdersListDiv);
            displayOrders(allPendingOrders, allPendingOrdersListDiv);

        } catch (error) {
            console.error('獲取儀表板數據失敗：', error);
            alert('載入儀表板數據失敗：' + error.message);
            recentOrdersListDiv.innerHTML = '<p>載入失敗。</p>';
            allPendingOrdersListDiv.innerHTML = '<p>載入失敗。</p>';
        }
    }

    // 輔助函數：顯示訂單列表
    function displayOrders(orders, containerDiv) {
        if (orders.length === 0) {
            containerDiv.innerHTML = '<p>沒有相關訂單。</p>';
            return;
        }

        let table = '<table><thead><tr><th>ID</th><th>客戶</th><th>電話</th><th>取貨/送貨時間</th><th>狀態</th><th>操作</th></tr></thead><tbody>';
        orders.forEach(order => {
            const pickupOrDeliveryTime = order.needsDelivery && order.deliveryTime
                ? order.deliveryTime.toDate().toLocaleString()
                : (order.pickupDateTime ? order.pickupDateTime.toDate().toLocaleString() : 'N/A');

            table += `
                <tr>
                    <td>${order.displayId || order.id.substring(0, 6).toUpperCase()}</td>
                    <td>${order.customerName}</td>
                    <td>${order.customerPhone}</td>
                    <td>${pickupOrDeliveryTime}</td>
                    <td>${order.orderStatus}</td>
                    <td>
                        <button class="edit-btn" data-id="${order.id}">編輯</button>
                        ${order.orderStatus !== '已取貨/送達' ? `<button class="mark-completed-btn" data-id="${order.id}">完成</button>` : ''}
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