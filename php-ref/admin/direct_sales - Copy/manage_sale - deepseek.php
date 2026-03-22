[file name]: manage_sale.php
[file content begin]
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
                            <input type="hidden" name="mechanic_id" value="<?= $logged_in_mechanic_id ?>">
                            <?php 
                            $me = $conn->query("SELECT id, CONCAT(firstname,' ',lastname) as name FROM mechanic_list WHERE id = '{$logged_in_mechanic_id}'");
                            if($me->num_rows > 0){
                                $me_row = $me->fetch_assoc();
                            ?>
                            <select class="form-control" disabled>
                                <option selected><?= $me_row['name'] ?></option>
                            </select>
                            <?php } ?>
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

                    <div class="col-md-4">
                        <label>Payment Mode <span class="text-danger">*</span></label>
                        <select name="payment_mode" id="payment_mode" class="form-control" required>
                            <option <?= isset($payment_mode) && $payment_mode == 'Cash' ? 'selected' : '' ?>>Cash</option>
                            <option <?= isset($payment_mode) && $payment_mode == 'UPI' ? 'selected' : '' ?>>UPI</option>
                            <option <?= isset($payment_mode) && $payment_mode == 'Card' ? 'selected' : '' ?>>Card</option>
                            <option <?= isset($payment_mode) && $payment_mode == 'Bank Transfer' ? 'selected' : '' ?>>Bank Transfer</option>
                        </select>
                    </div>
                </div>

                <!-- Payment Collection Section for Walk-in Customer -->
                <div class="row mt-3" id="walkin_payment_section" style="display: none;">
                    <div class="col-md-12">
                        <div class="card border border-primary">
                            <div class="card-header bg-primary text-white">
                                <h6 class="mb-0"><i class="fa fa-rupee-sign"></i> Collect Payment (Walk-in Customer)</h6>
                            </div>
                            <div class="card-body">
                                <div class="row">
                                    <div class="col-md-4">
                                        <label>Amount Received <span class="text-danger">*</span></label>
                                        <input type="number" step="0.01" id="amount_received" class="form-control" placeholder="Enter amount">
                                    </div>
                                    <div class="col-md-4">
                                        <label>Payment Date</label>
                                        <input type="date" id="payment_date" class="form-control" value="<?= date('Y-m-d') ?>">
                                    </div>
                                    <div class="col-md-4 d-flex align-items-end">
                                        <button type="button" id="collect_payment_btn" class="btn btn-success btn-block">
                                            <i class="fa fa-check"></i> Mark as Paid
                                        </button>
                                    </div>
                                </div>
                                <small class="text-muted">Note: This will record payment for walk-in customer only.</small>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Payment Modal Button for Registered Client -->
                <div class="row mt-3" id="client_payment_section" style="display: none;">
                    <div class="col-md-12">
                        <div class="alert alert-info">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <i class="fa fa-info-circle"></i> 
                                    <strong>Registered Client Selected</strong> - 
                                    <span id="selected_client_name"></span>
                                </div>
                                <div>
                                    <button type="button" class="btn btn-primary" id="open_client_payment_modal">
                                        <i class="fa fa-rupee-sign"></i> Record Payment
                                    </button>
                                    <a href="#" class="btn btn-secondary" id="view_client_ledger" target="_blank">
                                        <i class="fa fa-eye"></i> View Ledger
                                    </a>
                                </div>
                            </div>
                            <p class="mb-0 mt-2">Note: For registered clients, payments are recorded in their ledger and reflected in their balance.</p>
                        </div>
                    </div>
                </div>

                <hr>

                <!-- Product Selection -->
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
                
                <!-- Hidden fields for payment data -->
                <input type="hidden" id="payment_collected" name="payment_collected" value="0">
                <input type="hidden" id="payment_amount" name="payment_amount" value="0">
            </form>
        </div>
        <div class="card-footer text-right">
            <button class="btn btn-primary btn-flat" form="sale-form" id="save_sale_btn">Save Sale</button>
            <a href="./?page=direct_sales" class="btn btn-default btn-flat">Cancel</a>
        </div>
    </div>
</div>

<!-- Client Payment Modal (Same as in view_client.php) -->
<div class="modal fade" id="clientPaymentModal" tabindex="-1">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Record Client Payment</h5>
                <button type="button" class="close" data-dismiss="modal">&times;</button>
            </div>
            <form id="client-payment-form">
                <div class="modal-body">
                    <input type="hidden" name="client_id" id="modal_client_id" value="">
                    <input type="hidden" name="sale_id" id="modal_sale_id" value="<?= isset($id) ? $id : '' ?>">
                    
                    <div class="row">
                        <div class="col-md-4 form-group">
                            <label>Amount Received <span class="text-danger">*</span></label>
                            <input type="number" step="0.01" name="amount" id="modal_amount" class="form-control" required>
                        </div>
                        <div class="col-md-4 form-group">
                            <label>Receiving Date <span class="text-danger">*</span></label>
                            <input type="date" name="payment_date" id="modal_payment_date" class="form-control" value="<?= date('Y-m-d') ?>" required>
                        </div>
                        <div class="col-md-4 form-group">
                            <label>Discount (if any)</label>
                            <input type="number" step="0.01" name="discount" id="modal_discount" class="form-control" value="0">
                        </div>
                        <div class="col-md-6 form-group">
                            <label>Payment Mode <span class="text-danger">*</span></label>
                            <select name="payment_mode" id="modal_payment_mode" class="form-control" required>
                                <option value="Cash">Cash</option>
                                <option value="PhonePe/GPay">PhonePe/GPay</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="Card">Card</option>
                                <option value="UPI">UPI</option>
                            </select>
                        </div>
                        <div class="col-md-6 form-group">
                            <label>Reference (Optional)</label>
                            <input type="text" name="bill_no" id="modal_bill_no" class="form-control" placeholder="Bill/Reference No">
                        </div>
                        <div class="col-md-12 form-group">
                            <label>Remarks</label>
                            <textarea name="remarks" id="modal_remarks" class="form-control" rows="2"></textarea>
                        </div>
                    </div>
                    
                    <div class="alert alert-info">
                        <i class="fa fa-info-circle"></i> This payment will be recorded in the client's ledger and will affect their balance.
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="submit" class="btn btn-primary" id="save_payment_btn">Save Payment</button>
                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
                </div>
            </form>
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
        var clientName = $(this).find('option:selected').text();
        
        // Hide both sections initially
        $('#walkin_payment_section').hide();
        $('#client_payment_section').hide();
        
        if(clientId == '' || clientId == null) {
            // Walk-in customer selected
            $('#walkin_payment_section').show();
            $('#client_payment_section').hide();
            $('#selected_client_name').text('');
        } else {
            // Registered client selected
            $('#walkin_payment_section').hide();
            $('#client_payment_section').show();
            $('#selected_client_name').text(clientName);
            $('#modal_client_id').val(clientId);
            
            // Set View Ledger link
            $('#view_client_ledger').attr('href', './?page=clients/view_client&id=' + clientId);
        }
    });
    
    // Initialize on page load
    $('#client_id').trigger('change');

    // Collect Payment for Walk-in Customer
    $('#collect_payment_btn').click(function(){
        var amount = $('#amount_received').val();
        var total = parseFloat($('#total_amount').text().replace('₹', '').replace(/,/g, ''));
        
        if(!amount || amount <= 0) {
            alert_toast("Please enter a valid amount.", "warning");
            return;
        }
        
        if(parseFloat(amount) < total) {
            if(!confirm("Amount received is less than total. Do you want to proceed with partial payment?")) {
                return;
            }
        }
        
        // Mark as paid
        $('#payment_collected').val('1');
        $('#payment_amount').val(amount);
        
        // Show success message
        $(this).html('<i class="fa fa-check"></i> Payment Collected');
        $(this).removeClass('btn-success').addClass('btn-info');
        $(this).prop('disabled', true);
        
        // Disable amount field
        $('#amount_received').prop('disabled', true);
        
        alert_toast("Payment marked as collected.", "success");
    });

    // Open Client Payment Modal
    $('#open_client_payment_modal').click(function(){
        var total = parseFloat($('#total_amount').text().replace('₹', '').replace(/,/g, ''));
        $('#modal_amount').val(total);
        $('#clientPaymentModal').modal('show');
    });

    // Save Client Payment
    $('#client-payment-form').submit(function(e){
        e.preventDefault();
        
        var clientId = $('#modal_client_id').val();
        if(!clientId) {
            alert_toast("Please select a client first.", "warning");
            return;
        }
        
        start_loader();
        $('#save_payment_btn').prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Saving...');
        
        $.ajax({
            url: _base_url_+"classes/Master.php?f=save_client_payment",
            method: 'POST',
            data: $(this).serialize(),
            dataType: 'json',
            success: function(resp){
                end_loader();
                if(resp.status == 'success') {
                    alert_toast("Payment recorded successfully!", "success");
                    $('#clientPaymentModal').modal('hide');
                    
                    // Reset form
                    $('#client-payment-form')[0].reset();
                    $('#modal_payment_date').val('<?= date('Y-m-d') ?>');
                    $('#save_payment_btn').prop('disabled', false).html('Save Payment');
                    
                    // Update sale form to mark payment collected
                    $('#payment_collected').val('1');
                    $('#payment_amount').val($('#modal_amount').val());
                    
                    // Show success message
                    $('#open_client_payment_modal').html('<i class="fa fa-check"></i> Payment Recorded');
                    $('#open_client_payment_modal').removeClass('btn-primary').addClass('btn-success');
                    $('#open_client_payment_modal').prop('disabled', true);
                    
                } else {
                    alert_toast(resp.msg || "An error occurred", "error");
                    $('#save_payment_btn').prop('disabled', false).html('Save Payment');
                }
            },
            error: function(){
                end_loader();
                alert_toast("Server Error", "error");
                $('#save_payment_btn').prop('disabled', false).html('Save Payment');
            }
        });
    });

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
        
        // Update modal amount if client is selected
        var clientId = $('#client_id').val();
        if(clientId) {
            $('#modal_amount').val(total.toFixed(2));
        }
    }

    // Form Submit
    $('#sale-form').submit(function(e){
        e.preventDefault();
        if($('#item-list tbody tr').length == 0){
            alert_toast("Please add at least one product.",'warning');
            return;
        }
        
        // Check for walk-in customer payment
        var clientId = $('#client_id').val();
        var paymentCollected = $('#payment_collected').val();
        
        if(!clientId && paymentCollected == '0') {
            if(!confirm("No payment collected for walk-in customer. Do you want to save as unpaid?")) {
                return;
            }
        }
        
        start_loader();
        $('#save_sale_btn').prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Saving...');
        
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
    
    // Initialize total calculation
    calc_total();
});
</script>
[file content end]