var employees = [];
var invoices = [];
var currentEmployee = null;

function create_admin_element(tagName, className, text) {
    var element = document.createElement(tagName);
    if (className) {
        element.className = className;
    }
    if (text !== undefined) {
        element.textContent = text;
    }
    return element;
}

function show_admin_message(message, isError) {
    var element = document.getElementById("adminLoadMessage");
    element.textContent = message;
    element.classList.toggle("error", isError);
}

function format_admin_price(price) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(price);
}

function load_employees() {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "data/employees.json", true);
    xhr.send();

    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            if (xhr.status == 200 || xhr.status == 0) {
                try {
                    employees = JSON.parse(xhr.responseText);
                    if (!Array.isArray(employees)) {
                        throw new Error("Danh sách nhân viên không hợp lệ.");
                    }
                    document.getElementById("adminLoginMessage").textContent = "";
                } catch (error) {
                    document.getElementById("adminLoginMessage").textContent =
                        "Không đọc được dữ liệu nhân viên.";
                }
            } else {
                document.getElementById("adminLoginMessage").textContent =
                    "Không tải được dữ liệu nhân viên.";
            }
        }
    };

    xhr.onerror = function() {
        document.getElementById("adminLoginMessage").textContent =
            "Có lỗi khi tải dữ liệu nhân viên.";
    };
}

function login_employee(event) {
    event.preventDefault();
    var email = document.getElementById("employeeEmail").value.trim().toLowerCase();
    var password = document.getElementById("employeePassword").value;
    var message = document.getElementById("adminLoginMessage");
    currentEmployee = null;

    for (var i = 0; i < employees.length; i++) {
        if (employees[i].email.toLowerCase() == email &&
            employees[i].password == password &&
            employees[i].role == "admin") {
            currentEmployee = employees[i];
            break;
        }
    }

    if (!currentEmployee) {
        message.textContent = employees.length == 0
            ? "Chưa tải được dữ liệu nhân viên. Vui lòng kiểm tra file và thử lại."
            : "Email hoặc mật khẩu quản trị chưa đúng.";
        return;
    }

    document.getElementById("adminLoginCard").hidden = true;
    document.getElementById("adminPanel").hidden = false;
    document.getElementById("adminUserName").textContent =
        "Xin chào, " + currentEmployee.employeeName;
    render_dashboard();
}

function logout_employee() {
    currentEmployee = null;
    document.getElementById("adminPanel").hidden = true;
    document.getElementById("adminLoginCard").hidden = false;
    document.getElementById("adminLoginForm").reset();
    document.getElementById("adminLoginMessage").textContent = "";
}

function load_invoices() {
    var savedInvoices = [];
    try {
        var saved = localStorage.getItem("nhiStoreOrders");
        if (saved) {
            savedInvoices = JSON.parse(saved);
            if (!Array.isArray(savedInvoices)) {
                throw new Error("Danh sách đơn đã lưu không đúng định dạng.");
            }
        }
    } catch (error) {
        show_admin_message("Không đọc được các đơn hàng đã lưu trong LocalStorage.", true);
        savedInvoices = [];
    }

    var xhr = new XMLHttpRequest();
    xhr.open("GET", "data/carts.xml", true);
    xhr.send();
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            if ((xhr.status == 200 || xhr.status == 0) && xhr.responseText) {
                var xmlDoc = new DOMParser().parseFromString(xhr.responseText, "text/xml");
                if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
                    finish_invoice_load(savedInvoices, "File carts.xml không đúng định dạng XML.", true);
                } else {
                    read_xml_invoices(xmlDoc);
                    finish_invoice_load(savedInvoices, "Đã tải dữ liệu đơn hàng.", false);
                }
            } else {
                finish_invoice_load(savedInvoices, "Không tải được data/carts.xml.", true);
            }
        }
    };
    xhr.onerror = function() {
        finish_invoice_load(savedInvoices, "Có lỗi khi tải data/carts.xml.", true);
    };
}

function finish_invoice_load(savedInvoices, message, isError) {
    for (var i = 0; i < savedInvoices.length; i++) {
        invoices.push(savedInvoices[i]);
    }
    render_dashboard();
    show_admin_message(message + " Tổng cộng " + invoices.length + " đơn hàng.", isError);
}

function read_xml_invoices(xmlDoc) {
    var nodes = xmlDoc.getElementsByTagName("invoice");
    invoices = [];

    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var detailNodes = node.getElementsByTagName("detail");
        var details = [];

        for (var j = 0; j < detailNodes.length; j++) {
            var detail = detailNodes[j];
            details.push({
                productId: detail.getElementsByTagName("productId")[0].textContent.trim(),
                productName: detail.getElementsByTagName("productName")[0].textContent.trim(),
                quantity: Number(detail.getElementsByTagName("quantity")[0].textContent),
                price: Number(detail.getElementsByTagName("price")[0].textContent)
            });
        }

        invoices.push({
            id: node.getAttribute("id"),
            createdDate: node.getElementsByTagName("createdDate")[0].textContent.trim(),
            employeeName: node.getElementsByTagName("employeeName")[0].textContent.trim(),
            customerName: node.getElementsByTagName("customerName")[0].textContent.trim(),
            total: Number(node.getElementsByTagName("total")[0].textContent),
            status: node.getElementsByTagName("status")[0].textContent.trim(),
            details: details
        });
    }
}

function render_dashboard() {
    var revenue = 0;
    var soldCount = 0;
    var productSales = {};
    var tableBody = document.getElementById("orderTableBody");
    tableBody.innerHTML = "";

    for (var i = 0; i < invoices.length; i++) {
        var invoice = invoices[i];
        revenue += invoice.total;
        for (var j = 0; j < invoice.details.length; j++) {
            var detail = invoice.details[j];
            soldCount += detail.quantity;
            if (!productSales[detail.productId]) {
                productSales[detail.productId] = {
                    name: detail.productName,
                    quantity: 0
                };
            }
            productSales[detail.productId].quantity += detail.quantity;
        }

        var row = document.createElement("tr");
        var values = [
            invoice.id,
            invoice.createdDate,
            invoice.customerName,
            invoice.employeeName,
            format_admin_price(invoice.total),
            invoice.status
        ];
        for (var v = 0; v < values.length; v++) {
            row.appendChild(create_admin_element("td", "", values[v]));
        }
        tableBody.appendChild(row);
    }

    document.getElementById("orderCount").textContent = invoices.length;
    document.getElementById("revenueTotal").textContent = format_admin_price(revenue);
    document.getElementById("soldCount").textContent = soldCount;

    var bestSellers = [];
    for (var productId in productSales) {
        bestSellers.push({
            name: productSales[productId].name,
            quantity: productSales[productId].quantity
        });
    }
    bestSellers.sort(function(a, b) {
        return b.quantity - a.quantity;
    });

    var list = document.getElementById("bestSellerList");
    list.innerHTML = "";
    if (bestSellers.length == 0) {
        list.appendChild(create_admin_element("li", "", "Chưa có dữ liệu bán hàng."));
    }
    for (var k = 0; k < bestSellers.length; k++) {
        var item = create_admin_element("li", "", bestSellers[k].name);
        item.appendChild(create_admin_element("span", "", bestSellers[k].quantity + " sản phẩm đã bán"));
        list.appendChild(item);
    }
}

document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("adminLoginForm").addEventListener("submit", login_employee);
    document.getElementById("logoutAdminButton").addEventListener("click", logout_employee);
    load_employees();
    load_invoices();
});
