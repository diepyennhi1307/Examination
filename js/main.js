var products = [];
var reviews = [];
var customers = [];
var cart = {};
var currentCustomer = null;

function get_text(parent, tagName) {
    var element = parent.getElementsByTagName(tagName)[0];
    return element ? element.textContent.trim() : "";
}

function load_xml_file(path, onSuccess) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", path, true);
    xhr.send();

    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            if ((xhr.status == 200 || xhr.status == 0) && xhr.responseText) {
                var xmlDoc = new DOMParser().parseFromString(xhr.responseText, "text/xml");
                if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
                    show_load_message("Không đọc được dữ liệu XML: " + path, true);
                    return;
                }
                onSuccess(xmlDoc);
            } else {
                show_load_message("Không tải được " + path + ". Hãy mở trang bằng Live Server để đọc file dữ liệu.", true);
            }
        }
    };

    xhr.onerror = function() {
        show_load_message("Có lỗi khi tải " + path + ". Hãy kiểm tra file và thử lại.", true);
    };
}

function load_json_file(path, onSuccess) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", path, true);
    xhr.send();

    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            if ((xhr.status == 200 || xhr.status == 0) && xhr.responseText) {
                try {
                    var records = JSON.parse(xhr.responseText);
                    if (!Array.isArray(records)) {
                        throw new Error("Dữ liệu cần có dạng danh sách.");
                    }
                    onSuccess(records);
                } catch (error) {
                    show_load_message("Không đọc được dữ liệu JSON: " + path, true);
                }
            } else {
                show_load_message("Không tải được " + path + ". Hãy kiểm tra file dữ liệu.", true);
            }
        }
    };

    xhr.onerror = function() {
        show_load_message("Có lỗi khi tải " + path + ".", true);
    };
}

function show_load_message(message, isError) {
    var element = document.getElementById("loadMessage");
    element.textContent = message;
    element.classList.toggle("error", isError);
}

function show_skeletons() {
    var grid = document.getElementById("productGrid");
    grid.innerHTML = "";

    for (var i = 0; i < 8; i++) {
        var card = document.createElement("div");
        card.className = "skeleton-card";
        card.innerHTML =
            '<div class="skeleton-image"></div>' +
            '<div class="skeleton-content">' +
            '<div class="skeleton-line short"></div>' +
            '<div class="skeleton-line"></div>' +
            '<div class="skeleton-line"></div>' +
            "</div>";
        grid.appendChild(card);
    }
}

function read_products(xmlDoc) {
    var nodes = xmlDoc.getElementsByTagName("product");
    products = [];

    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var ratingNode = node.getElementsByTagName("rating")[0];
        var colorNodes = node.getElementsByTagName("color");
        var colors = [];

        for (var j = 0; j < colorNodes.length; j++) {
            colors.push(colorNodes[j].textContent.trim());
        }

        var price = Number(get_text(node, "price"));
        var discount = Number(get_text(node, "discount")) || 0;
        products.push({
            id: node.getAttribute("id"),
            title: get_text(node, "title"),
            price: price,
            salePrice: price * (1 - discount / 100),
            discount: discount,
            description: get_text(node, "description"),
            category: get_text(node, "category"),
            image: get_text(node, "image"),
            stock: Number(get_text(node, "stock")) || 0,
            colors: colors,
            rating: ratingNode ? Number(ratingNode.getAttribute("rate")) : 0,
            ratingCount: ratingNode ? Number(ratingNode.getAttribute("count")) : 0,
            averageRating: null
        });
    }

    populate_categories();
    update_product_ratings();
    show_load_message("Đã tải " + products.length + " sản phẩm từ products.xml.", false);
    apply_product_filters();
    render_cart();
}

function read_reviews(xmlDoc) {
    var nodes = xmlDoc.getElementsByTagName("review");
    reviews = [];

    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        reviews.push({
            productId: node.getAttribute("productId"),
            customerName: get_text(node, "customerName"),
            rating: Number(get_text(node, "rating")),
            comment: get_text(node, "comment"),
            date: get_text(node, "date")
        });
    }

    update_product_ratings();
    apply_product_filters();
}

function update_product_ratings() {
    for (var p = 0; p < products.length; p++) {
        var productReviews = get_product_reviews(products[p].id);
        if (productReviews.length > 0) {
            var totalRating = 0;
            for (var r = 0; r < productReviews.length; r++) {
                totalRating += productReviews[r].rating;
            }
            products[p].averageRating = totalRating / productReviews.length;
        }
    }
}

function get_product_reviews(productId) {
    var found = [];
    for (var i = 0; i < reviews.length; i++) {
        if (reviews[i].productId == productId) {
            found.push(reviews[i]);
        }
    }
    return found;
}

function populate_categories() {
    var select = document.getElementById("categoryFilter");
    var categories = [];

    for (var i = 0; i < products.length; i++) {
        if (categories.indexOf(products[i].category) == -1) {
            categories.push(products[i].category);
        }
    }
    categories.sort();

    for (var j = 0; j < categories.length; j++) {
        var option = document.createElement("option");
        option.value = categories[j];
        option.textContent = categories[j];
        select.appendChild(option);
    }
}

function get_display_rating(product) {
    return product.averageRating === null ? product.rating : product.averageRating;
}

function format_price(price) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(price);
}

function create_element(tagName, className, text) {
    var element = document.createElement(tagName);
    if (className) {
        element.className = className;
    }
    if (text !== undefined) {
        element.textContent = text;
    }
    return element;
}

function get_filtered_products() {
    var keyword = document.getElementById("keyword").value.trim().toLowerCase();
    var category = document.getElementById("categoryFilter").value;
    var minPrice = document.getElementById("minPrice").value;
    var maxPrice = document.getElementById("maxPrice").value;
    var minRating = Number(document.getElementById("ratingFilter").value);
    var inStock = document.getElementById("stockFilter").checked;
    var filtered = [];

    for (var i = 0; i < products.length; i++) {
        var product = products[i];
        var rating = get_display_rating(product);
        var text = (product.title + " " + product.category + " " + product.description).toLowerCase();

        if (keyword && text.indexOf(keyword) == -1) {
            continue;
        }
        if (category && product.category != category) {
            continue;
        }
        if (minPrice !== "" && product.salePrice < Number(minPrice)) {
            continue;
        }
        if (maxPrice !== "" && product.salePrice > Number(maxPrice)) {
            continue;
        }
        if (rating < minRating) {
            continue;
        }
        if (inStock && product.stock < 1) {
            continue;
        }
        filtered.push(product);
    }

    var sort = document.getElementById("sortFilter").value;
    if (sort == "price-low") {
        filtered.sort(function(a, b) { return a.salePrice - b.salePrice; });
    } else if (sort == "price-high") {
        filtered.sort(function(a, b) { return b.salePrice - a.salePrice; });
    } else if (sort == "rating") {
        filtered.sort(function(a, b) { return get_display_rating(b) - get_display_rating(a); });
    } else if (sort == "name") {
        filtered.sort(function(a, b) { return a.title.localeCompare(b.title); });
    }

    return filtered;
}

function apply_product_filters() {
    if (products.length == 0) {
        return;
    }

    var filtered = get_filtered_products();
    render_products(filtered);
    document.getElementById("productResult").textContent =
        "Hiển thị " + filtered.length + " / " + products.length + " sản phẩm";
    document.getElementById("emptyProducts").hidden = filtered.length > 0;
}

function render_products(list) {
    var grid = document.getElementById("productGrid");
    grid.innerHTML = "";

    for (var i = 0; i < list.length; i++) {
        var product = list[i];
        var card = create_element("article", "product-card");
        var imageWrap = create_element("div", "product-image-wrap");
        var image = create_element("img", "product-image");
        image.src = product.image;
        image.alt = product.title;
        image.loading = "lazy";
        image.onerror = function() {
            this.hidden = true;
        };
        imageWrap.appendChild(image);

        if (product.discount > 0) {
            imageWrap.appendChild(create_element("span", "discount-badge", "-" + product.discount + "%"));
        }

        var info = create_element("div", "product-info");
        info.appendChild(create_element("p", "product-category", product.category));
        info.appendChild(create_element("h3", "product-title", product.title));

        var rating = get_display_rating(product);
        var ratingText = create_element("p", "product-rating");
        ratingText.appendChild(create_element("span", "average-rating", "★ " + rating.toFixed(1)));
        ratingText.appendChild(document.createTextNode(" "));
        ratingText.appendChild(create_element("span", "", "(" + get_product_reviews(product.id).length + " đánh giá)"));
        info.appendChild(ratingText);

        var price = create_element("p", "product-price");
        price.appendChild(create_element("span", "", format_price(product.salePrice)));
        if (product.discount > 0) {
            price.appendChild(create_element("span", "old-price", format_price(product.price)));
        }
        info.appendChild(price);

        var stockClass = product.stock > 0 ? "stock-label" : "stock-label out-of-stock";
        info.appendChild(create_element("p", stockClass, product.stock > 0 ? "Còn " + product.stock + " sản phẩm" : "Tạm hết hàng"));

        var actions = create_element("div", "product-actions");
        var quickButton = create_element("button", "", "Xem nhanh");
        quickButton.type = "button";
        quickButton.dataset.action = "quick-view";
        quickButton.dataset.id = product.id;

        var addButton = create_element("button", "", "Thêm giỏ hàng");
        addButton.type = "button";
        addButton.dataset.action = "add";
        addButton.dataset.id = product.id;
        addButton.dataset.variant = product.colors.length > 0 ? product.colors[0] : "";
        addButton.disabled = product.stock < 1;

        if (product.colors.length > 1) {
            var colorSelect = create_element("select", "variant-select");
            colorSelect.setAttribute("aria-label", "Chọn màu " + product.title);
            colorSelect.dataset.id = product.id;
            for (var c = 0; c < product.colors.length; c++) {
                var colorOption = create_element("option", "", product.colors[c]);
                colorOption.value = product.colors[c];
                colorSelect.appendChild(colorOption);
            }
            actions.appendChild(colorSelect);
        }

        actions.appendChild(quickButton);
        actions.appendChild(addButton);
        info.appendChild(actions);
        card.appendChild(imageWrap);
        card.appendChild(info);
        grid.appendChild(card);
    }
}

function find_product(productId) {
    for (var i = 0; i < products.length; i++) {
        if (products[i].id == productId) {
            return products[i];
        }
    }
    return null;
}

function render_quick_view(product) {
    var content = document.getElementById("quickViewContent");
    content.innerHTML = "";

    var layout = create_element("div", "quick-view-layout");
    var image = create_element("img", "quick-view-image");
    image.src = product.image;
    image.alt = product.title;
    image.onerror = function() {
        this.hidden = true;
    };
    layout.appendChild(image);

    var details = create_element("div", "quick-view-details");
    details.appendChild(create_element("p", "eyebrow", product.category));
    details.appendChild(create_element("h2", "", product.title));
    details.appendChild(create_element("p", "product-price", format_price(product.salePrice)));
    details.appendChild(create_element("p", "quick-view-description", product.description));

    var rating = get_display_rating(product);
    var productReviews = get_product_reviews(product.id);
    details.appendChild(create_element("p", "review-stars", "★ " + rating.toFixed(1) + " / 5 (" + productReviews.length + " đánh giá)"));

    var reviewList = create_element("div", "review-list");
    if (productReviews.length == 0) {
        reviewList.appendChild(create_element("p", "result-count", "Chưa có đánh giá cho sản phẩm này."));
    } else {
        for (var i = 0; i < productReviews.length; i++) {
            var review = create_element("article", "review-item");
            var reviewer = create_element("strong", "", review.customerName + " ");
            reviewer.appendChild(create_element("span", "review-stars", "★ " + review.rating));
            review.appendChild(reviewer);
            review.appendChild(create_element("p", "", review.comment));
            review.appendChild(create_element("p", "result-count", review.date));
            reviewList.appendChild(review);
        }
    }
    details.appendChild(reviewList);

    var addButton = create_element("button", "primary-button", "Thêm vào giỏ hàng");
    addButton.type = "button";
    addButton.dataset.action = "quick-add";
    addButton.dataset.id = product.id;
    addButton.dataset.variant = product.colors.length > 0 ? product.colors[0] : "";
    addButton.disabled = product.stock < 1;
    details.appendChild(addButton);

    layout.appendChild(details);
    content.appendChild(layout);
    document.getElementById("quickViewDialog").showModal();
}

function read_saved_cart() {
    try {
        var saved = localStorage.getItem("nhiStoreCart");
        if (!saved) {
            return {};
        }
        var parsed = JSON.parse(saved);
        if (!parsed || typeof parsed != "object" || Array.isArray(parsed)) {
            throw new Error("Giỏ hàng đã lưu không đúng định dạng.");
        }
        for (var id in parsed) {
            if (!parsed[id] || !Number.isInteger(parsed[id].quantity) || parsed[id].quantity < 1) {
                throw new Error("Số lượng trong giỏ hàng đã lưu không hợp lệ.");
            }
        }
        return parsed;
    } catch (error) {
        show_load_message("Không đọc được giỏ hàng đã lưu. Giỏ hàng mới sẽ được sử dụng.", true);
        return {};
    }
}

function save_cart() {
    try {
        localStorage.setItem("nhiStoreCart", JSON.stringify(cart));
        return true;
    } catch (error) {
        show_load_message("Không lưu được giỏ hàng vào LocalStorage.", true);
        return false;
    }
}

function add_to_cart(productId, variant) {
    var product = find_product(productId);
    if (!product) {
        show_load_message("Không tìm thấy sản phẩm cần thêm vào giỏ.", true);
        return;
    }

    var currentQuantity = cart[productId] ? cart[productId].quantity : 0;
    if (currentQuantity >= product.stock) {
        show_load_message("Sản phẩm chỉ còn " + product.stock + " món trong kho.", true);
        return;
    }

    cart[productId] = {
        quantity: currentQuantity + 1,
        variant: variant || product.colors[0] || ""
    };
    if (save_cart()) {
        render_cart();
        show_load_message("Đã thêm sản phẩm vào giỏ hàng.", false);
    }
}

function get_cart_quantity() {
    var quantity = 0;
    for (var id in cart) {
        quantity += cart[id].quantity;
    }
    return quantity;
}

function render_cart() {
    var items = document.getElementById("cartItems");
    var totalElement = document.getElementById("cartTotal");
    var total = 0;
    var quantity = get_cart_quantity();
    items.innerHTML = "";

    for (var id in cart) {
        var product = find_product(id);
        if (!product) {
            continue;
        }

        var entry = cart[id];
        var item = create_element("div", "cart-item");
        var info = create_element("div", "");
        info.appendChild(create_element("span", "cart-item-name", product.title));
        var variantText = entry.variant ? " · " + entry.variant : "";
        info.appendChild(create_element("span", "cart-item-price", format_price(product.salePrice) + variantText));

        var controls = create_element("div", "quantity-controls");
        var decrease = create_element("button", "", "−");
        decrease.type = "button";
        decrease.dataset.action = "decrease";
        decrease.dataset.id = id;
        decrease.setAttribute("aria-label", "Giảm số lượng " + product.title);

        controls.appendChild(decrease);
        controls.appendChild(create_element("span", "", entry.quantity));

        var increase = create_element("button", "", "+");
        increase.type = "button";
        increase.dataset.action = "increase";
        increase.dataset.id = id;
        increase.setAttribute("aria-label", "Tăng số lượng " + product.title);
        controls.appendChild(increase);
        item.appendChild(info);
        item.appendChild(controls);
        items.appendChild(item);

        total += product.salePrice * entry.quantity;
    }

    if (quantity == 0) {
        items.appendChild(create_element("p", "cart-empty", "Giỏ hàng đang trống."));
    }

    totalElement.textContent = format_price(total);
    document.getElementById("cartCount").textContent = quantity;
    document.getElementById("panelCartCount").textContent = "(" + quantity + ")";
    document.getElementById("checkoutButton").disabled = quantity == 0;
}

function change_cart_quantity(productId, change) {
    if (!cart[productId]) {
        return;
    }

    var product = find_product(productId);
    var nextQuantity = cart[productId].quantity + change;
    if (nextQuantity < 1) {
        delete cart[productId];
    } else if (product && nextQuantity <= product.stock) {
        cart[productId].quantity = nextQuantity;
    } else {
        show_load_message("Số lượng trong giỏ không thể vượt quá tồn kho.", true);
        return;
    }

    if (save_cart()) {
        render_cart();
    }
}

function validate_customer_email() {
    var input = document.getElementById("customerEmail");
    var message = document.getElementById("customerEmailMessage");
    var email = input.value.trim();
    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var isValid = email == "" || emailPattern.test(email);

    input.setCustomValidity(isValid ? "" : "Email chưa đúng định dạng.");
    message.textContent = isValid ? "" : "Email chưa đúng định dạng.";
    return isValid;
}

function validate_checkout_phone() {
    var input = document.getElementById("checkoutPhone");
    var message = document.getElementById("checkoutPhoneMessage");
    var phone = input.value.trim();
    var phonePattern = /^0[0-9]{9}$/;
    var isValid = phone == "" || phonePattern.test(phone);

    input.setCustomValidity(isValid ? "" : "Nhập số điện thoại gồm 10 chữ số, bắt đầu bằng số 0.");
    message.textContent = isValid ? "" : "Số điện thoại cần có 10 chữ số và bắt đầu bằng số 0.";
    return isValid;
}

function login_customer() {
    var email = document.getElementById("customerEmail").value.trim().toLowerCase();
    var password = document.getElementById("customerPassword").value;
    var message = document.getElementById("customerLoginMessage");
    currentCustomer = null;

    if (!validate_customer_email()) {
        return;
    }

    for (var i = 0; i < customers.length; i++) {
        if (customers[i].email.toLowerCase() == email && customers[i].password == password) {
            currentCustomer = customers[i];
            break;
        }
    }

    if (!currentCustomer) {
        message.textContent = customers.length == 0
            ? "Đang tải dữ liệu khách hàng. Vui lòng thử lại."
            : "Email hoặc mật khẩu khách hàng chưa đúng.";
        return;
    }

    document.getElementById("checkoutName").value = currentCustomer.customerName;
    document.getElementById("checkoutPhone").value = currentCustomer.phone;
    document.getElementById("checkoutAddress").value = currentCustomer.address;
    message.textContent = "Đăng nhập thành công. Thông tin giao hàng đã được điền.";
}

function get_saved_invoices() {
    try {
        var saved = localStorage.getItem("nhiStoreOrders");
        if (!saved) {
            return [];
        }
        var parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) {
            throw new Error("Danh sách đơn hàng đã lưu không đúng định dạng.");
        }
        return parsed;
    } catch (error) {
        show_load_message("Không đọc được các đơn hàng đã lưu trong LocalStorage.", true);
        return [];
    }
}

function submit_order(event) {
    event.preventDefault();
    var form = document.getElementById("checkoutForm");
    var message = document.getElementById("checkoutMessage");
    if (!form.reportValidity()) {
        return;
    }
    if (!currentCustomer) {
        message.textContent = "Vui lòng đăng nhập bằng tài khoản khách hàng trước khi đặt hàng.";
        return;
    }
    if (get_cart_quantity() == 0) {
        message.textContent = "Giỏ hàng đang trống.";
        return;
    }

    var phone = document.getElementById("checkoutPhone").value.trim();
    if (!validate_checkout_phone()) {
        document.getElementById("checkoutPhone").reportValidity();
        return;
    }

    var submitButton = document.getElementById("submitOrderButton");
    submitButton.disabled = true;
    message.textContent = "Đang xử lý thanh toán mô phỏng...";

    var details = [];
    var total = 0;
    for (var id in cart) {
        var product = find_product(id);
        if (product) {
            details.push({
                productId: product.id,
                productName: product.title,
                quantity: cart[id].quantity,
                price: product.salePrice,
                variant: cart[id].variant
            });
            total += product.salePrice * cart[id].quantity;
        }
    }

    var order = {
        id: "HD" + new Date().getTime(),
        createdDate: new Date().toISOString().slice(0, 10),
        customerId: currentCustomer.customerId,
        customerName: document.getElementById("checkoutName").value.trim(),
        customerEmail: currentCustomer.email,
        customerPhone: phone,
        shippingAddress: document.getElementById("checkoutAddress").value.trim(),
        employeeName: "Đơn hàng trực tuyến",
        total: total,
        status: "Đã đặt hàng",
        paymentMethod: document.getElementById("paymentMethod").value,
        details: details
    };

    var xhr = new XMLHttpRequest();
    var paymentUrl = "data/payment-response.json?amount=" +
        encodeURIComponent(total.toFixed(2)) +
        "&method=" + encodeURIComponent(order.paymentMethod);
    xhr.open("GET", paymentUrl, true);
    xhr.send();
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            if (xhr.status == 200 || xhr.status == 0) {
                var response;
                try {
                    response = JSON.parse(xhr.responseText);
                } catch (error) {
                    message.textContent = "Phản hồi thanh toán không hợp lệ.";
                    submitButton.disabled = false;
                    return;
                }

                if (!response.success) {
                    message.textContent = response.message || "Thanh toán chưa thành công.";
                    submitButton.disabled = false;
                    return;
                }

                var savedOrders = get_saved_invoices();
                savedOrders.push(order);
                try {
                    localStorage.setItem("nhiStoreOrders", JSON.stringify(savedOrders));
                    localStorage.removeItem("nhiStoreCart");
                } catch (error) {
                    message.textContent = "Không lưu được đơn hàng. Hãy kiểm tra LocalStorage và thử lại.";
                    submitButton.disabled = false;
                    return;
                }

                cart = {};
                currentCustomer = null;
                render_cart();
                form.reset();
                document.getElementById("checkoutDialog").close();
                show_load_message("Đặt hàng thành công. Mã đơn: " + order.id, false);
            } else {
                message.textContent = "Không kết nối được dịch vụ thanh toán mô phỏng.";
            }
            submitButton.disabled = false;
        }
    };
    xhr.onerror = function() {
        message.textContent = "Có lỗi kết nối tới dịch vụ thanh toán. Vui lòng thử lại.";
        submitButton.disabled = false;
    };
}

document.addEventListener("DOMContentLoaded", function() {
    show_skeletons();
    cart = read_saved_cart();

    document.getElementById("searchForm").addEventListener("submit", function(event) {
        event.preventDefault();
        var minInput = document.getElementById("minPrice");
        var maxInput = document.getElementById("maxPrice");
        maxInput.setCustomValidity("");
        if (minInput.value !== "" && maxInput.value !== "" && Number(maxInput.value) < Number(minInput.value)) {
            maxInput.setCustomValidity("Giá đến phải lớn hơn hoặc bằng giá từ.");
            maxInput.reportValidity();
            return;
        }
        apply_product_filters();
    });

    document.getElementById("searchForm").addEventListener("reset", function() {
        window.setTimeout(apply_product_filters, 0);
    });
    document.getElementById("sortFilter").addEventListener("change", apply_product_filters);
    document.getElementById("maxPrice").addEventListener("input", function() {
        this.setCustomValidity("");
    });

    document.getElementById("productGrid").addEventListener("change", function(event) {
        if (event.target.classList.contains("variant-select")) {
            var addButton = event.target.parentElement.querySelector('[data-action="add"]');
            addButton.dataset.variant = event.target.value;
        }
    });

    document.getElementById("productGrid").addEventListener("click", function(event) {
        var button = event.target.closest("button[data-action]");
        if (!button) {
            return;
        }
        var product = find_product(button.dataset.id);
        if (!product) {
            return;
        }

        if (button.dataset.action == "add") {
            add_to_cart(button.dataset.id, button.dataset.variant);
        } else if (button.dataset.action == "quick-view") {
            render_quick_view(product);
        }
    });

    document.getElementById("quickViewContent").addEventListener("click", function(event) {
        var button = event.target.closest('button[data-action="quick-add"]');
        if (button) {
            add_to_cart(button.dataset.id, button.dataset.variant);
        }
    });

    document.getElementById("cartItems").addEventListener("click", function(event) {
        var button = event.target.closest("button[data-action]");
        if (!button) {
            return;
        }
        if (button.dataset.action == "increase") {
            change_cart_quantity(button.dataset.id, 1);
        } else if (button.dataset.action == "decrease") {
            change_cart_quantity(button.dataset.id, -1);
        }
    });

    document.getElementById("cartPanelToggle").addEventListener("click", function() {
        var panel = document.getElementById("cartPanel");
        var content = document.getElementById("cartContent");
        var expanded = this.getAttribute("aria-expanded") == "true";
        this.setAttribute("aria-expanded", !expanded);
        content.hidden = expanded;
        panel.classList.toggle("is-collapsed", expanded);
        document.getElementById("cartPanelArrow").textContent = expanded ? "⌃" : "⌄";
    });

    document.getElementById("cartButton").addEventListener("click", function() {
        var toggle = document.getElementById("cartPanelToggle");
        if (toggle.getAttribute("aria-expanded") != "true") {
            toggle.click();
        }
        document.getElementById("cartPanel").scrollIntoView({ behavior: "smooth", block: "end" });
    });

    document.getElementById("checkoutButton").addEventListener("click", function() {
        if (get_cart_quantity() > 0) {
            document.getElementById("checkoutMessage").textContent = "";
            document.getElementById("customerLoginMessage").textContent = "";
            document.getElementById("checkoutForm").reset();
            document.getElementById("customerEmail").setCustomValidity("");
            document.getElementById("checkoutPhone").setCustomValidity("");
            document.getElementById("customerEmailMessage").textContent = "";
            document.getElementById("checkoutPhoneMessage").textContent = "";
            currentCustomer = null;
            document.getElementById("checkoutDialog").showModal();
        }
    });
    document.getElementById("checkoutForm").addEventListener("submit", submit_order);
    document.getElementById("customerLoginButton").addEventListener("click", login_customer);
    document.getElementById("customerEmail").addEventListener("input", function() {
        currentCustomer = null;
        document.getElementById("customerLoginMessage").textContent = "";
        validate_customer_email();
    });
    document.getElementById("customerPassword").addEventListener("input", function() {
        currentCustomer = null;
        document.getElementById("customerLoginMessage").textContent = "";
    });
    document.getElementById("checkoutPhone").addEventListener("input", function() {
        validate_checkout_phone();
    });

    document.addEventListener("click", function(event) {
        var closeButton = event.target.closest("[data-close-dialog]");
        if (closeButton) {
            document.getElementById(closeButton.dataset.closeDialog).close();
        }
    });

    render_cart();

    load_xml_file("data/products.xml", read_products);
    load_xml_file("data/reviews.xml", read_reviews);
    load_json_file("data/customers.json", function(records) {
        customers = records;
    });
});
