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
?>
<div class="content py-3">
    <div class="card card-outline card-primary rounded-0 shadow">
        <div class="card-header">
            <h5 class="card-title"><?= isset($id) ? "Update" : "New" ?> Direct Sale</h5>
        </div>
        <div class="card-body">
            <form id="sale-form">
                <input type="hidden" name="id" value="<?= isset($id) ? $id : '' ?>">
                
                <div class="row">
                    <div class="col-md-4">
                        <label>Sold By (Staff) <span class="text-danger">*</span></label>
                        <?php if($user_type == 2): // Agar Staff Login hai ?>
                            <input type="hidden" name="mechanic_id" value="<?= $user_mechanic_id ?>">
                            <select class="form-control" disabled>
                                <?php 
                                $me = $conn->query("SELECT id, CONCAT(firstname,' ',lastname) as name FROM mechanic_list WHERE id = '{$user_mechanic_id}'");
                                $me_row = $me->fetch_assoc();
                                ?>
                                <option selected><?= $me_row['name'] ?></option>
                            </select>
                        <?php else: // Agar Admin Login hai ?>
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
                        <label>Client</label>
                        <select name="client_id" id="client_sel" class="form-control select2">
                            <option value="">Walk-in Customer</option>
                            <?php 
                            $clients = $conn->query("SELECT id, CONCAT(firstname,' ',COALESCE(CONCAT(middlename,' '),''), lastname) as name FROM client_list WHERE delete_flag = 0 ORDER BY name ASC");
                            while($row = $clients->fetch_assoc()):
                            ?>
                            <option value="<?= $row['id'] ?>" <?= isset($client_id) && $client_id == $row['id'] ? 'selected' : '' ?>><?= $row['name'] ?></option>
                            <?php endwhile; ?>
                        </select>
                    </div>

                    <div class="col-md-4" id="payment_mode_div">
                        <label>Payment Mode <span class="text-danger">*</span></label>
                        <select name="payment_mode" id="payment_mode" class="form-control" required>
                            <option <?= isset($payment_mode) && $payment_mode == 'Cash' ? 'selected' : '' ?>>Cash</option>
                            <option <?= isset($payment_mode) && $payment_mode == 'UPI' ? 'selected' : '' ?>>UPI</option>
                            <option <?= isset($payment_mode) && $payment_mode == 'Card' ? 'selected' : '' ?>>Card</option>
                            <option <?= isset($payment_mode) && $payment_mode == 'Bank Transfer' ? 'selected' : '' ?>>Bank Transfer</option>
                        </select>
                    </div>
                    
                    <input type="hidden" name="hidden_payment_mode" id="hidden_payment_mode" value="">
                </div>

                <hr>

                <div class="row align-items-end mb-3">
                    <div class="col-md-8">
                        <label>Select Product</label>
                        <select id="product_sel" class="form-control select2" data-placeholder="Select Product Here">
                            <option value="" disabled selected></option>
                            <?php 
                            $products = $conn->query("SELECT id, name, price FROM product_list WHERE delete_flag = 0 ORDER BY name ASC");
                            while($row = $products->fetch_assoc()):
                            ?>
                            <option value="<?= $row['id'] ?>" data-price="<?= $row['price'] ?>"><?= $row['name'] ?> - ₹<?= number_format($row['price'],2) ?></option>
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
                        ?>
                        <tr>
                            <td class="product_name"><?= $row['name'] ?><input type="hidden" name="product_id[]" value="<?= $row['product_id'] ?>"></td>
                            <td><input type="number" name="qty[]" class="form-control text-center" value="<?= $row['qty'] ?>" min="1" required></td>
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
                        <textarea name="remarks" class="form-control" rows="3"><?= isset($remarks) ? $remarks : '' ?></textarea>
                    </div>
                </div>
            </form>
        </div>
        <div class="card-footer text-right">
            <button class="btn btn-primary btn-flat" form="sale-form">Save Sale</button>
            <a href="./?page=direct_sales" class="btn btn-default btn-flat">Cancel</a>
        </div>
    </div>
</div>

<script>
$(function(){
    $('.select2').select2({
        width: '100%'
    });

    // --- NEW LOGIC: Toggle Payment Mode based on Client Selection ---
    function togglePaymentMode() {
        var client_id = $('#client_sel').val();
        
        if (client_id && client_id != "") {
            // Client Selected -> Hide Payment Option (Credit Sale)
            $('#payment_mode_div').hide();
            $('#payment_mode').prop('required', false);
            
            // Backend ko 'Credit' bhejne ke liye, hum select ki value change kar sakte hain 
            // ya agar backend restricted enum hai to 'Bank Transfer' ya naya option use karein.
            // Filhal hum ise ek naye hidden option 'Credit' par set karenge agar DB allow kare, 
            // Varna hum is field ko disable karke hidden input use karenge.
            
            // Option 1: Add a 'Credit' option temporarily if not exists
            if ($("#payment_mode option[value='Credit']").length == 0) {
                $('#payment_mode').append('<option value="Credit">Credit</option>');
            }
            $('#payment_mode').val('Credit');
            
        } else {
            // Walk-in Customer -> Show Payment Option
            $('#payment_mode_div').show();
            $('#payment_mode').prop('required', true);
            // Default to Cash if Credit was selected
            if ($('#payment_mode').val() == 'Credit') {
                $('#payment_mode').val('Cash');
            }
        }
    }

    // Run on change
    $('#client_sel').change(function() {
        togglePaymentMode();
    });

    // Run on init (agar edit page ho aur client selected ho)
    togglePaymentMode();
    // -----------------------------------------------------------

    // Add Product Button
    $('#add_product').click(function(){
        var product_id = $('#product_sel').val();
        var product_name = $('#product_sel option:selected').text().split(' - ')[0];
        var price = $('#product_sel option:selected').data('price');

        if(!product_id){
            alert_toast("Please select a product first.", "warning");
            return;
        }

        var tr = `
        <tr>
            <td class="product_name">${product_name}<input type="hidden" name="product_id[]" value="${product_id}"></td>
            <td><input type="number" name="qty[]" class="form-control text-center" value="1" min="1" required></td>
            <td><input type="number" name="price[]" class="form-control text-right" value="${price}" step="0.01" required></td>
            <td class="text-right product_total">${parseFloat(price).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
            <td class="text-center"><button type="button" class="btn btn-sm btn-danger rem-product"><i class="fa fa-trash"></i></button></td>
        </tr>`;

        $('#item-list tbody').append(tr);
        calc_total();
        $('#product_sel').val('').trigger('change');
    });

    // Qty or Price Change → Recalculate
    $(document).on('input change', '[name="qty[]"], [name="price[]"]', function(){
        var tr = $(this).closest('tr');
        var qty = parseFloat(tr.find('[name="qty[]"]').val()) || 0;
        var price = parseFloat(tr.find('[name="price[]"]').val()) || 0;
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

    // Form Submit
    $('#sale-form').submit(function(e){
        e.preventDefault();
        if($('#item-list tbody tr').length == 0){
            alert_toast("Please add at least one product.",'warning');
            return;
        }
        start_loader();
        $.ajax({
            url:_base_url_+"classes/Master.php?f=save_direct_sale",
            data: new FormData($(this)[0]),
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
                    alert_toast("An error occurred",'error');
                }
                end_loader();
            }
        })
    });
});
</script>