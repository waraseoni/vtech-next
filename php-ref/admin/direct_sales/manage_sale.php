<?php 
if(isset($_GET['id']) && $_GET['id'] > 0){
    $qry = $conn->query("SELECT * FROM direct_sales where id = {$_GET['id']}");
    if($qry->num_rows > 0){
        $res = $qry->fetch_array();
        foreach($res as $k => $v){
            $$k = $v;
        }
    }
}

// Login user ka data nikalna
$user_type = $_settings->userdata('type'); // 1 = Admin, 2 = Staff
$logged_in_mechanic_id = $_settings->userdata('mechanic_id');

// Current user ka name nikalna (for edit tracking)
$current_user_name = "";
if($user_type == 2 && !empty($logged_in_mechanic_id)) {
    $user_qry = $conn->query("SELECT CONCAT(firstname,' ',lastname) as name FROM mechanic_list WHERE id = '{$logged_in_mechanic_id}'");
    if($user_qry->num_rows > 0) {
        $current_user_name = $user_qry->fetch_assoc()['name'];
    }
} else {
    $current_user_name = $_settings->userdata('firstname') . ' ' . $_settings->userdata('lastname');
}
?>

<div class="content py-3">
    <div class="card card-outline card-primary rounded-0 shadow">
        <div class="card-header">
            <h5 class="card-title"><?= isset($id) ? "Update" : "New" ?> Direct Sale</h5>
        </div>
        <div class="card-body">
            <form id="sale-form">
                <input type="hidden" name="id" value="<?= isset($id) ? $id : '' ?>">
                
                <!-- Hidden field for edit tracking -->
                <input type="hidden" name="edited_by_user" value="<?= $current_user_name ?>">
                <input type="hidden" name="edited_by_type" value="<?= $user_type ?>">
                <input type="hidden" name="edited_by_mechanic_id" value="<?= $user_type == 2 ? $logged_in_mechanic_id : 0 ?>">
                
                <div class="row">
                    <div class="col-md-4">
                        <label>Sold By (Staff) <span class="text-danger">*</span></label>
                        <?php 
                        if(isset($id) && $id > 0): 
                            // Edit Mode - Show original sales person
                            $original_mechanic_qry = $conn->query("SELECT id, CONCAT(firstname,' ',lastname) as name FROM mechanic_list WHERE id = '{$mechanic_id}'");
                            if($original_mechanic_qry->num_rows > 0){
                                $original_mechanic = $original_mechanic_qry->fetch_assoc();
                            ?>
                            <input type="hidden" name="mechanic_id" value="<?= $mechanic_id ?>">
                            <select class="form-control" disabled>
                                <option selected><?= $original_mechanic['name'] ?> (Original)</option>
                            </select>
                            <?php } ?>
                        <?php elseif($user_type == 2): // New sale by Staff ?>
                            <?php if(!empty($logged_in_mechanic_id)): ?>
                                <input type="hidden" name="mechanic_id" value="<?= $logged_in_mechanic_id ?>">
                                <?php 
                                $me = $conn->query("SELECT id, CONCAT(firstname,' ',lastname) as name FROM mechanic_list WHERE id = '{$logged_in_mechanic_id}'");
                                if($me->num_rows > 0){
                                    $me_row = $me->fetch_assoc();
                                ?>
                                <select class="form-control" disabled>
                                    <option selected><?= $me_row['name'] ?></option>
                                </select>
                                <?php } else { ?>
                                    <div class="alert alert-danger">Staff record not found!</div>
                                <?php } ?>
                            <?php else: ?>
                                <div class="alert alert-warning">No staff assigned to your account!</div>
                            <?php endif; ?>
                        <?php else: // New sale by Admin ?>
                            <select name="mechanic_id" class="form-control select2" required>
                                <option value="" disabled selected>Select Staff</option>
                                <?php 
                                $mechanics = $conn->query("SELECT id, CONCAT(firstname,' ',lastname) as name FROM mechanic_list WHERE status = 1 ORDER BY name ASC");
                                while($row = $mechanics->fetch_assoc()):
                                ?>
                                <option value="<?= $row['id'] ?>" <?= isset($mechanic_id) && $mechanic_id == $row['id'] ? 'selected' : '' ?>>
                                    <?= $row['name'] ?>
                                </option>
                                <?php endwhile; ?>
                            </select>
                        <?php endif; ?>
                    </div>

                    <div class="col-md-4">
                        <label>Client (Optional)</label>
                        <select name="client_id" id="client_id" class="form-control select2">
                            <option value="">Walk-in Customer</option>
                            <?php 
                            $clients = $conn->query("SELECT id, CONCAT(firstname,' ',COALESCE(CONCAT(middlename,' '),''), lastname) as name FROM client_list WHERE delete_flag = 0 ORDER BY name ASC");
                            while($row = $clients->fetch_assoc()):
                            ?>
                            <option value="<?= $row['id'] ?>" <?= isset($client_id) && $client_id == $row['id'] ? 'selected' : '' ?>><?= $row['name'] ?></option>
                            <?php endwhile; ?>
                        </select>
                    </div>

                    <div class="col-md-4" id="payment_mode_section">
                        <label>Payment Mode <span class="text-danger">*</span></label>
                        <select name="payment_mode" id="payment_mode" class="form-control" required>
                            <option value="Cash" <?= isset($payment_mode) && $payment_mode == 'Cash' ? 'selected' : '' ?>>Cash</option>
                            <option value="UPI" <?= isset($payment_mode) && $payment_mode == 'UPI' ? 'selected' : '' ?>>UPI</option>
                            <option value="Card" <?= isset($payment_mode) && $payment_mode == 'Card' ? 'selected' : '' ?>>Card</option>
                            <option value="Bank Transfer" <?= isset($payment_mode) && $payment_mode == 'Bank Transfer' ? 'selected' : '' ?>>Bank Transfer</option>
                        </select>
                    </div>
                </div>

                <!-- Hidden field for credit payment mode (for clients) -->
                <input type="hidden" id="credit_payment_mode" value="Credit">
                
                <!-- Payment Info Alert for Credit Sales -->
                <div class="row mt-3" id="credit_alert_section" style="display: none;">
                    <div class="col-md-12">
                        <div class="alert alert-warning">
                            <i class="fa fa-info-circle"></i> 
                            <strong>Registered Client Selected</strong> - 
                            Payment mode will be set to <strong>"Credit"</strong> by default. 
                            Payment can be recorded later in the client's ledger.
                        </div>
                    </div>
                </div>

                <hr>

                <!-- Edit Info Section (Only show when editing existing sale) -->
                <?php if(isset($id) && $id > 0): ?>
                <div class="row mb-3">
                    <div class="col-md-12">
                        <div class="alert alert-info">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <i class="fa fa-info-circle"></i> 
                                    <strong>Editing Existing Sale</strong>
                                </div>
                                <div>
                                    <small class="text-muted">
                                        <i class="fa fa-user-edit"></i> 
                                        Current Editor: <strong><?= $current_user_name ?></strong>
                                        (<?= $user_type == 1 ? 'Admin' : 'Staff' ?>)
                                    </small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <?php endif; ?>

                <!-- Product Selection with Stock Info -->
                <div class="row align-items-end mb-3">
                    <div class="col-md-8">
                        <label>Select Product</label>
                        <select id="product_sel" class="form-control select2" data-placeholder="Select Product Here">
                            <option value="" disabled selected></option>
                            <?php 
                            $products = $conn->query("
                                SELECT p.id, p.name, p.price, 
                                COALESCE(
                                    (SELECT SUM(quantity) FROM inventory_list WHERE product_id = p.id), 0
                                ) - 
                                COALESCE(
                                    (SELECT SUM(qty) FROM (
                                        SELECT product_id, qty FROM transaction_products tp 
                                        JOIN transaction_list tl ON tp.transaction_id = tl.id 
                                        WHERE tl.status != 4
                                        UNION ALL
                                        SELECT product_id, qty FROM direct_sale_items
                                    ) as sales WHERE product_id = p.id), 0
                                ) as available_stock
                                FROM product_list p 
                                WHERE p.delete_flag = 0 AND p.status = 1
                                ORDER BY p.name
                            ");
                            while($row = $products->fetch_assoc()):
                                $stock_display = $row['available_stock'] >= 0 
                                    ? number_format($row['available_stock']) 
                                    : '<span class="text-danger">'.number_format($row['available_stock']).'</span>';
                            ?>
                            <option value="<?= $row['id'] ?>" 
                                    data-price="<?= $row['price'] ?>"
                                    data-stock="<?= $row['available_stock'] ?>">
                                <?= $row['name'] ?> - ₹<?= number_format($row['price'],2) ?> 
                                (Stock: <?= $stock_display ?>)
                            </option>
                            <?php endwhile; ?>
                        </select>
                    </div>
                    <div class="col-md-4">
                        <button type="button" id="add_product" class="btn btn-success btn-block"><i class="fa fa-plus"></i> Add Product</button>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-12 text-right">
                        <h4>Total: <span id="total_amount">₹0.00</span></h4>
                    </div>
                </div>

                <table class="table table-bordered" id="item-list">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th width="12%">Qty</th>
                            <th width="15%">Price</th>
                            <th width="15%">Total</th>
                            <th width="8%"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if(isset($id)): 
                        $items_qry = $conn->query("SELECT dsi.*, p.name FROM direct_sale_items dsi JOIN product_list p ON dsi.product_id = p.id WHERE dsi.sale_id = '$id'");
                        while($row = $items_qry->fetch_assoc()):
                            // Current available stock for this product (for edit mode reference)
                            $current_stock_qry = $conn->query("
                                SELECT 
                                COALESCE((SELECT SUM(quantity) FROM inventory_list WHERE product_id = '{$row['product_id']}'), 0) -
                                COALESCE((SELECT SUM(qty) FROM (
                                    SELECT product_id, qty FROM transaction_products tp 
                                    JOIN transaction_list tl ON tp.transaction_id = tl.id 
                                    WHERE tl.status != 4 AND tl.id != '$id'
                                    UNION ALL
                                    SELECT product_id, qty FROM direct_sale_items dsi2 
                                    JOIN direct_sales ds ON dsi2.sale_id = ds.id 
                                    WHERE ds.id != '$id' AND dsi2.product_id = '{$row['product_id']}'
                                ) as sales), 0) as current_available
                            ");
                            $current_stock = $current_stock_qry->num_rows > 0 ? $current_stock_qry->fetch_assoc()['current_available'] : 0;
                        ?>
                        <tr>
                            <td class="product_name"><?= htmlspecialchars($row['name']) ?><input type="hidden" name="product_id[]" value="<?= $row['product_id'] ?>"></td>
                            <td>
                                <input type="number" name="qty[]" class="form-control text-center" 
                                       value="<?= $row['qty'] ?>" 
                                       min="1" 
                                       data-original-qty="<?= $row['qty'] ?>"
                                       data-current-available="<?= $current_stock ?>"
                                       required>
                            </td>
                            <td><input type="number" name="price[]" class="form-control text-right" value="<?= $row['price'] ?>" step="0.01" required></td>
                            <td class="text-right product_total"><?= number_format($row['qty'] * $row['price'], 2) ?></td>
                            <td class="text-center"><button type="button" class="btn btn-sm btn-danger rem-product"><i class="fa fa-trash"></i></button></td>
                        </tr>
                        <?php endwhile; endif; ?>
                    </tbody>
                </table>

                <div class="row mt-3">
                    <div class="col-md-12">
                        <label>Remarks (Optional)</label>
                        <textarea name="remarks" class="form-control" rows="3"><?= isset($remarks) ? htmlspecialchars($remarks) : '' ?></textarea>
                    </div>
                </div>
            </form>
        </div>
        <div class="card-footer text-right">
            <button class="btn btn-primary btn-flat" form="sale-form" id="save_sale_btn">
                <?php if(isset($id) && $id > 0): ?>
                    <i class="fa fa-save"></i> Update Sale (Edited by: <?= htmlspecialchars($current_user_name) ?>)
                <?php else: ?>
                    <i class="fa fa-save"></i> Save Sale
                <?php endif; ?>
            </button>
            <a href="./?page=direct_sales" class="btn btn-default btn-flat">Cancel</a>
        </div>
    </div>
</div>

<script>
$(function(){
    $('.select2').select2({
        width: '100%'
    });

    // Client selection change handler
    $('#client_id').change(function(){
        var clientId = $(this).val();
        
        if(clientId == '' || clientId == null) {
            $('#payment_mode_section').show();
            $('#credit_alert_section').hide();
            $('#payment_mode').prop('required', true);
        } else {
            $('#payment_mode_section').hide();
            $('#credit_alert_section').show();
            $('#payment_mode').prop('required', false);
        }
    });
    
    // Initialize on page load
    if($('#client_id').val() != '') {
        $('#payment_mode_section').hide();
        $('#credit_alert_section').show();
        $('#payment_mode').prop('required', false);
    }

    // Add Product Button with stock validation
    $('#add_product').click(function(){
        var product_id = $('#product_sel').val();
        if(!product_id){
            alert_toast("Please select a product first.", "warning");
            return;
        }

        var stock = parseFloat($('#product_sel option:selected').data('stock')) || 0;
        var product_name = $('#product_sel option:selected').text().split(' - ')[0].trim();
        var price = $('#product_sel option:selected').data('price');

        // Stock check for new addition
        if(stock <= 0){
            alert_toast("Stock khatam ho gaya hai! (" + stock + " available)", "error");
            return;
        }

        // Check if already added
        var alreadyAdded = false;
        $('#item-list tbody tr').each(function(){
            if($(this).find('input[name="product_id[]"]').val() == product_id){
                alreadyAdded = true;
                return false;
            }
        });

        if(alreadyAdded){
            alert_toast("This product is already added.", "warning");
            return;
        }

        var tr = `
        <tr>
            <td class="product_name">${product_name}<input type="hidden" name="product_id[]" value="${product_id}"></td>
            <td><input type="number" name="qty[]" class="form-control text-center" value="1" min="1" max="${stock}" data-original-qty="1" data-current-available="${stock}" required></td>
            <td><input type="number" name="price[]" class="form-control text-right" value="${price}" step="0.01" required></td>
            <td class="text-right product_total">${parseFloat(price).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
            <td class="text-center"><button type="button" class="btn btn-sm btn-danger rem-product"><i class="fa fa-trash"></i></button></td>
        </tr>`;

        $('#item-list tbody').append(tr);
        calc_total();
        $('#product_sel').val('').trigger('change');
    });

    // Qty change → validate & recalculate
    $(document).on('input change', '[name="qty[]"]', function(){
        var input = $(this);
        var tr = input.closest('tr');
        var qty = parseFloat(input.val()) || 0;
        var originalQty = parseFloat(input.data('original-qty')) || 0;
        var currentAvailable = parseFloat(input.data('current-available')) || 0;

        if (qty < 1) {
            input.val(1);
            qty = 1;
        }

        // Only validate if quantity is increased beyond original
        if (qty > originalQty) {
            var extraNeeded = qty - originalQty;
            if (extraNeeded > currentAvailable) {
                alert_toast("Extra quantity required exceeds current available stock!", "warning");
                input.val(originalQty + currentAvailable);
                qty = originalQty + currentAvailable;
            }
        }

        var price = parseFloat(tr.find('[name="price[]"]').val()) || 0;
        var total = qty * price;
        tr.find('.product_total').text(total.toLocaleString('en-IN', {minimumFractionDigits: 2}));
        calc_total();
    });

    // Price change → only recalculate (no stock check)
    $(document).on('input change', '[name="price[]"]', function(){
        var tr = $(this).closest('tr');
        var qty = parseFloat(tr.find('[name="qty[]"]').val()) || 0;
        var price = parseFloat($(this).val()) || 0;
        var total = qty * price;
        tr.find('.product_total').text(total.toLocaleString('en-IN', {minimumFractionDigits: 2}));
        calc_total();
    });

    // Remove Product
    $(document).on('click', '.rem-product', function(){
        if(confirm("Are you sure to remove this product from sale?")){
            $(this).closest('tr').remove();
            calc_total();
        }
    });

    function calc_total(){
        var total = 0;
        $('.product_total').each(function(){
            total += parseFloat($(this).text().replace(/,/g, '')) || 0;
        });
        $('#total_amount').text('₹' + total.toLocaleString('en-IN', {minimumFractionDigits: 2}));
    }

    // Form Submit with smart stock validation
    $('#sale-form').submit(function(e){
        e.preventDefault();
        
        if($('#item-list tbody tr').length == 0){
            alert_toast("Please add at least one product.",'warning');
            return;
        }
        
        // Stock validation logic
        let stockError = false;
        let errorMessages = [];

        $('#item-list tbody tr').each(function(){
            var qtyInput = $(this).find('[name="qty[]"]');
            var currentQty = parseFloat(qtyInput.val()) || 0;
            var originalQty = parseFloat(qtyInput.data('original-qty')) || currentQty;
            var currentAvailable = parseFloat(qtyInput.data('current-available')) || 0;

            if (currentQty > originalQty) {
                var extraNeeded = currentQty - originalQty;
                if (extraNeeded > currentAvailable) {
                    stockError = true;
                    var productName = $(this).find('.product_name').text().trim();
                    errorMessages.push(
                        `${productName}: Extra ${extraNeeded} required, but only ${currentAvailable} available`
                    );
                }
            }
        });

        if(stockError){
            let msg = "Stock issue:\n" + errorMessages.join("\n");
            alert_toast(msg, "error");
            return;
        }

        var clientId = $('#client_id').val();
        var paymentMode = '';
        
        if(clientId == '' || clientId == null) {
            paymentMode = $('#payment_mode').val();
            if(!paymentMode) {
                alert_toast("Please select a payment mode for walk-in customer.", "warning");
                return;
            }
        } else {
            paymentMode = 'Credit to Client';
        }
        
        var formData = new FormData($(this)[0]);
        formData.delete('payment_mode');
        formData.append('payment_mode', paymentMode);
        
        if($('input[name="id"]').val() != '') {
            var editDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
            formData.append('last_edited_date', editDate);
        }
        
        start_loader();
        $('#save_sale_btn').prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Saving...');
        
        $.ajax({
            url: _base_url_ + "classes/Master.php?f=save_direct_sale",
            data: formData,
            cache: false,
            contentType: false,
            processData: false,
            method: 'POST',
            type: 'POST',
            dataType: 'json',
            success:function(resp){
                if(resp.status == 'success'){
                    location.href = "./?page=direct_sales/view_sale&id="+resp.id;
                }else{
                    alert_toast("An error occurred: " + (resp.msg || 'Unknown error'),'error');
                    $('#save_sale_btn').prop('disabled', false).html('Save Sale');
                }
                end_loader();
            },
            error: function() {
                end_loader();
                alert_toast("Server Error", "error");
                $('#save_sale_btn').prop('disabled', false).html('Save Sale');
            }
        })
    });
    
    // Initialize total
    calc_total();
});
</script>