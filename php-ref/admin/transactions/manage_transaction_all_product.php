<?php 
if(isset($_GET['id'])){
    $qry = $conn->query("SELECT * FROM `transaction_list` WHERE id = '{$_GET['id']}' ");
    if($qry->num_rows > 0){
        foreach($qry->fetch_assoc() as $k => $v){
            if(!is_numeric($k)) $$k = $v;
        }
    } else {
        echo '<script>alert("Unknown Transaction ID."); location.replace("./?page=transactions");</script>';
        exit;
    }
}
?>

<div class="content py-3">
    <div class="container-fluid">
        <div class="card card-outline card-primary shadow-sm rounded-0">
            <div class="card-header rounded-0 bg-navy py-2">
                <div class="d-flex justify-content-between align-items-center">
                    <h5 class="card-title text-white mb-0">
                        <i class="fa fa-plus-circle"></i>
                        <b><?= isset($id) ? "Update - $code" : "New Transaction" ?></b>
                    </h5>
                    <div class="card-tools">
                        <?php if(isset($id)): ?>
                            <a href="./?page=transactions/view_details&id=<?= $id ?>" class="btn btn-light btn-sm border rounded-0 px-3 py-1">
                                <i class="fa fa-times"></i> Cancel
                            </a>
                        <?php else: ?>
                            <a href="./?page=transactions" class="btn btn-light btn-sm border rounded-0 px-3 py-1">
                                <i class="fa fa-times"></i> Cancel
                            </a>
                        <?php endif; ?>
                    </div>
                </div>
            </div>

            <div class="card-body p-3">
                <form id="transaction-form" enctype="multipart/form-data" class="compact-form">
                    <input type="hidden" name="id" value="<?= isset($id) ? $id : '' ?>">
                    <input type="hidden" name="amount" value="<?= isset($amount) ? $amount : '0' ?>">

                    <!-- Client & Basic Info -->
                    <div class="row g-2 mb-3">
                        <div class="col-md-6">
                            <label class="control-label text-navy fw-bold small">
                                <i class="fa fa-user"></i> Client <span class="text-danger">*</span>
                            </label>
							<a href="javascript:void(0)" id="add_new_client" class="text-primary small fw-bold">
                                    <i class="fa fa-plus"></i> Add New Client
                                </a>
                            <select name="client_name" id="client_name" class="form-control form-control-sm border-secondary rounded-0 bg-white select2" required>
                                <option value="" disabled <?= !isset($client_name) ? "selected" : "" ?>>Select Client</option>
                                <?php 
                                $clients = $conn->query("SELECT *, CONCAT(firstname,' ',IFNULL(middlename,''),' ',lastname) as name FROM client_list WHERE delete_flag = 0 ORDER BY name ASC");
                                while($row = $clients->fetch_assoc()):
                                ?>
                                <option value="<?= $row['id'] ?>" <?= isset($client_name) && $client_name == $row['id'] ? 'selected' : '' ?>>
                                    <?= $row['name'] ?>
                                </option>
                                <?php endwhile; ?>
                            </select>
                            <div id="balance-holder" class="mt-1 small" style="display:none">
                                <span id="balance_label">Due: </span> 
                                <span id="client-due-amount" class="fw-bold">0.00</span>
                            </div>
                        </div>
                        <div class="col-md-2">
							<label class="control-label text-navy fw-bold small">
								<i class="fa fa-file-alt"></i> Job No. <span class="text-danger">*</span>
							</label>
								<input 	type="text" 
										name="job_id" 
										id="job_id" 
										class="form-control form-control-sm border-secondary rounded-0 <?= isset($id) ? 'bg-light' : 'bg-white' ?>" 
										value="<?= isset($job_id) ? $job_id : '' ?>" 
										<?php echo isset($id) ? 'readonly' : 'readonly placeholder="Auto"'; ?> 
										required>
						</div>
                        <div class="col-md-4">
                            <label class="control-label text-navy fw-bold small">
                                <i class="fa fa-user-cog"></i> Mechanic <span class="text-danger">*</span>
                            </label>
                            <select name="mechanic_id" id="mechanic_id" class="form-control form-control-sm border-secondary rounded-0 bg-white select2" required>
                                <option value="" disabled <?= !isset($mechanic_id) ? "selected" : "" ?>>Select Mechanic</option>
                                <?php 
                                $mechanic_qry = $conn->query("SELECT *,concat(firstname,' ', coalesce(concat(middlename,' '),''), lastname) as `name` FROM `mechanic_list` where delete_flag = 0 and `status` = 1 ".(isset($mechanic_id) && !is_null($mechanic_id) ? " or id = '{$mechanic_id}' " : '')." order by `name` asc");
                                while($row = $mechanic_qry->fetch_array()):
                                ?>
                                <option value="<?= $row['id'] ?>" <?= isset($mechanic_id) && $mechanic_id == $row['id'] ? "selected" : "" ?>><?= $row['name'] ?></option>
                                <?php endwhile; ?>
                            </select>
                        </div>
                        
                    </div>

                    <!-- Item Details -->
                    <div class="row g-2 mb-3">
                        <div class="col-md-5">
                            <label class="control-label text-navy fw-bold small">
                                <i class="fa fa-mobile-alt"></i> Item/Model <span class="text-danger">*</span>
                            </label>
                            <input type="text" name="item" id="item" class="form-control form-control-sm border-secondary rounded-0 bg-white" value="<?= isset($item) ? $item : '' ?>" required>
                        </div>
                        <div class="col-md-7">
                            <label class="control-label text-navy fw-bold small">
                                <i class="fa fa-bug"></i> Fault Reported <span class="text-danger">*</span>
                            </label>
                            <input type="text" name="fault" id="fault" class="form-control form-control-sm border-secondary rounded-0 bg-white" value="<?= isset($fault) ? $fault : '' ?>" required>
                        </div>
						
                    </div>

                    <!-- Remarks -->
                    <div class="row mb-3">
					<div class="col-md-3">
                            <label class="control-label text-navy fw-bold small">
                                <i class="fa fa-calendar-check"></i> Location
                            </label>
                            <input type="text" name="uniq_id" id="uniq_id" class="form-control form-control-sm border-secondary rounded-0 bg-white" value="<?= isset($uniq_id) ? $uniq_id : '' ?>" placeholder="Item location">
                        </div>
                        <div class="col-md-9">
                            <label class="control-label text-navy fw-bold small">
                                <i class="fa fa-comment-dots"></i> Remarks
                            </label>
                            <textarea name="remark" id="remark" rows="2" class="form-control form-control-sm border-secondary rounded-0 bg-white"><?= isset($remark) ? $remark : '' ?></textarea>
                        </div>
                    </div>

                    <!-- Photos Upload -->
                    <div class="row mb-3">
                        <div class="col-md-12">
                            <fieldset class="border p-2 rounded-0 bg-light">
                                <legend class="w-auto text-primary fw-bold small px-2">
                                    <i class="fa fa-camera"></i> Item Photos
                                </legend>
                                <div class="form-group mb-2">
                                    <div class="input-group input-group-sm">
                                        <input type="text" id="file-names-display" class="form-control form-control-sm rounded-0" placeholder="No photos selected" readonly>
                                        <button type="button" class="btn btn-primary btn-sm" id="browse-photos">
                                            <i class="fa fa-folder-open"></i> Browse
                                        </button>
                                    </div>
                                    <input type="file" id="item_photos_trigger" class="form-control form-control-sm rounded-0" accept="image/*" multiple style="display:none;">
                                    <small class="text-muted d-block mt-1 small">Max 10MB per photo. Selected: <span id="selected-count">0</span></small>
                                </div>
                                
                                <div id="image-preview" class="row mt-2" style="display:none;">
                                    <!-- Preview will appear here -->
                                </div>
                                
                                <?php if(isset($id)): ?>
                                <div class="mt-2">
                                    <label class="control-label text-navy fw-bold small">Existing Photos:</label>
                                    <div class="row mt-1" id="existing-photos">
                                        <?php 
                                        $photo_qry = $conn->query("SELECT * FROM transaction_images WHERE transaction_id = '{$id}' ORDER BY date_created DESC");
                                        if($photo_qry->num_rows > 0):
                                            while($photo = $photo_qry->fetch_assoc()):
                                                $photo_path = base_url . $photo['image_path'];
                                        ?>
                                        <div class="col-md-2 col-4 mb-2 text-center position-relative">
                                            <img src="<?= $photo_path ?>" 
                                                 class="img-thumbnail" 
                                                 style="height:80px; width:100%; object-fit:cover; cursor:pointer;" 
                                                 onclick="viewer_modal('<?= $photo_path ?>')">
                                            <button type="button" 
                                                    class="btn btn-danger btn-xs position-absolute top-0 end-0 m-0 delete-photo" 
                                                    style="padding: 0.1rem 0.3rem; font-size: 0.7rem;"
                                                    data-id="<?= $photo['id'] ?>">
                                                <i class="fa fa-trash"></i>
                                            </button>
                                        </div>
                                        <?php 
                                            endwhile;
                                        else:
                                        ?>
                                        <div class="col-12 text-center py-1 text-muted small">
                                            <em>No photos uploaded</em>
                                        </div>
                                        <?php endif; ?>
                                    </div>
                                </div>
                                <?php endif; ?>
                            </fieldset>
                        </div>
                    </div>

                    <!-- Services & Products Section -->
                    <div class="row">
                        <!-- Services -->
                        <div class="col-md-6 mb-3">
                            <fieldset class="border p-2 rounded-0 bg-light h-100">
                                <legend class="w-auto text-primary fw-bold small px-2"><i class="fa fa-wrench"></i> Services</legend>
                                <div class="row g-2 mb-2">
                                    <div class="col-9">
                                        <select id="service_sel" class="form-control form-control-sm border-secondary rounded-0 bg-white">
                                            <option value="" disabled selected>Select Service</option>
                                            <?php 
                                            $services = $conn->query("SELECT * FROM service_list WHERE delete_flag = 0 AND status = 1 ORDER BY name");
                                            while($row = $services->fetch_assoc()):
                                            ?>
                                            <option value="<?= $row['id'] ?>" data-price="<?= $row['price'] ?>" data-name="<?= htmlspecialchars($row['name']) ?>">
                                                <?= $row['name'] ?> (₹<?= number_format($row['price'],2) ?>)
                                            </option>
                                            <?php endwhile; ?>
                                        </select>
                                    </div>
                                    <div class="col-3">
                                        <button type="button" id="add_service" class="btn btn-primary btn-sm w-100"><i class="fa fa-plus"></i> Add</button>
                                    </div>
                                </div>

                                <div class="table-responsive" style="max-height: 250px; overflow-y: auto;">
                                    <table class="table table-sm table-bordered mb-1" id="service-list">
                                        <thead class="bg-navy text-white">
                                            <tr>
                                                <th width="10%"></th>
                                                <th>Service</th>
                                                <th width="30%">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <?php if(isset($id)): 
                                                $svc_qry = $conn->query("SELECT ts.*, s.name as service_name FROM transaction_services ts INNER JOIN service_list s ON ts.service_id = s.id WHERE ts.transaction_id = '$id'");
                                                while($row = $svc_qry->fetch_assoc()):
                                            ?>
                                            <tr>
                                                <td class="text-center">
                                                    <button type="button" class="btn btn-sm btn-danger rounded-0 rem-service p-0 px-1"><i class="fa fa-trash"></i></button>
                                                </td>
                                                <td>
                                                    <input type="hidden" name="service_id[]" value="<?= $row['service_id'] ?>">
                                                    <input type="text" name="service_name[]" class="form-control form-control-sm border-0 p-0 service_name_input" value="<?= htmlspecialchars($row['service_name']) ?>" required>
                                                </td>
                                                <td>
                                                    <input type="number" name="service_price[]" class="form-control form-control-sm border-0 p-0 text-right service_price_input" value="<?= $row['price'] ?>" step="0.01" required>
                                                </td>
                                            </tr>
                                            <?php endwhile; endif; ?>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="text-end bg-light p-1">
                                    <strong>Service Total: <span id="service_total">₹0.00</span></strong>
                                </div>
                            </fieldset>
                        </div>

                        <!-- Products -->
                        <div class="col-md-6 mb-3">
                            <fieldset class="border p-2 rounded-0 bg-light h-100">
                                <legend class="w-auto text-success fw-bold small px-2"><i class="fa fa-box"></i> Products</legend>
                                <div class="row g-2 mb-2">
                                    <div class="col-9">
                                        <select id="product_sel" class="form-control form-control-sm border-secondary rounded-0 bg-white">
                                            <option value="" disabled selected>Select Product</option>
                                            <?php 
                                            $products = $conn->query("SELECT * FROM product_list WHERE delete_flag = 0 AND status = 1 ORDER BY name");
                                            while($row = $products->fetch_assoc()):
                                            ?>
                                            <option value="<?= $row['id'] ?>" data-price="<?= $row['price'] ?>" data-name="<?= htmlspecialchars($row['name']) ?>">
                                                <?= $row['name'] ?> (₹<?= number_format($row['price'],2) ?>)
                                            </option>
                                            <?php endwhile; ?>
                                        </select>
                                    </div>
                                    <div class="col-3">
                                        <button type="button" id="add_product" class="btn btn-success btn-sm w-100"><i class="fa fa-plus"></i> Add</button>
                                    </div>
                                </div>

                                <div class="table-responsive" style="max-height: 250px; overflow-y: auto;">
                                    <table class="table table-sm table-bordered mb-1" id="product-list">
                                        <thead class="bg-success text-white">
                                            <tr>
                                                <th width="10%"></th>
                                                <th>Product</th>
                                                <th width="15%">Qty</th>
                                                <th width="25%">Price</th>
                                                <th width="25%">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <?php if(isset($id)): 
                                                $prod_qry = $conn->query("SELECT tp.*, p.name as product_name FROM transaction_products tp INNER JOIN product_list p ON tp.product_id = p.id WHERE tp.transaction_id = '$id'");
                                                while($row = $prod_qry->fetch_assoc()):
                                            ?>
                                            <tr>
                                                <td class="text-center">
                                                    <button type="button" class="btn btn-sm btn-danger rounded-0 rem-product p-0 px-1"><i class="fa fa-trash"></i></button>
                                                </td>
                                                <td>
                                                    <input type="hidden" name="product_id[]" value="<?= $row['product_id'] ?>">
                                                    <input type="text" name="product_name[]" class="form-control form-control-sm border-0 p-0 product_name_input" value="<?= htmlspecialchars($row['product_name']) ?>" required>
                                                </td>
                                                <td>
                                                    <input type="number" name="product_qty[]" class="form-control form-control-sm border-0 p-0 text-center product_qty_input" min="1" value="<?= $row['qty'] ?>" required>
                                                </td>
                                                <td>
                                                    <input type="number" name="product_price[]" class="form-control form-control-sm border-0 p-0 text-right product_price_input" value="<?= $row['price'] ?>" step="0.01" required>
                                                </td>
                                                <td class="text-right fw-bold product_total">
                                                    ₹<?= number_format($row['qty'] * $row['price'], 2) ?>
                                                </td>
                                            </tr>
                                            <?php endwhile; endif; ?>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="text-end bg-light p-1">
                                    <strong>Product Total: <span id="product_total">₹0.00</span></strong>
                                </div>
                            </fieldset>
                        </div>
                    </div>

                    <!-- Total & Commission -->
                    <div class="row mb-3">
                        <div class="col-md-8">
                            <div class="card border-primary shadow-sm rounded-0">
                                <div class="card-body bg-primary text-white py-2 px-3">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <h5 class="mb-0">Total Payable Amount</h5>
                                        <h4 class="mb-0" id="amount">₹0.00</h4>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <?php if($_settings->userdata('type') == 1): ?>
                            <div class="form-group mb-0">
                                <label class="control-label text-navy fw-bold small">Mechanic Commission</label>
                                <div class="input-group input-group-sm">
                                    <span class="input-group-text"><i class="fas fa-coins text-warning"></i></span>
                                    <input type="number" step="any" name="mechanic_commission_amount" id="mechanic_commission_amount" 
                                           class="form-control text-right" 
                                           value="<?php echo isset($mechanic_commission_amount) ? $mechanic_commission_amount : 0; ?>">
                                </div>
                                <small class="text-muted small">Admin can edit</small>
                            </div>
                            <?php else: ?>
                                <input type="hidden" name="mechanic_commission_amount" value="<?php echo isset($mechanic_commission_amount) ? $mechanic_commission_amount : 0; ?>">
                            <?php endif; ?>
                        </div>
                    </div>

                    <!-- Save Button -->
                    <div class="text-center">
                        <button type="submit" class="btn btn-primary px-4 rounded-0 shadow-sm">
                            <i class="fa fa-save"></i> <?= isset($id) ? "Update" : "Save" ?>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>

<!-- Compact CSS -->
<style>
    .compact-form .form-control-sm {
        padding: 0.25rem 0.5rem;
        font-size: 0.875rem;
        height: calc(1.5em + 0.5rem + 2px);
    }
    
    .compact-form .form-control.border-0 {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
    }
    
    .compact-form .form-control.border-0:focus {
        background: #fff !important;
        border: 1px solid #007bff !important;
        box-shadow: 0 0 0 0.2rem rgba(0,123,255,0.25) !important;
    }
    
    .compact-form table {
        font-size: 0.875rem;
    }
    
    .compact-form table th,
    .compact-form table td {
        padding: 0.3rem;
        vertical-align: middle;
    }
    
    .compact-form .select2-container--default .select2-selection--single {
        height: calc(1.5em + 0.5rem + 2px) !important;
        border-radius: 0 !important;
    }
    
    .compact-form .select2-container--default .select2-selection--single .select2-selection__rendered {
        line-height: calc(1.5em + 0.5rem) !important;
        padding-left: 0.5rem !important;
        font-size: 0.875rem;
    }
    
    .compact-form fieldset {
        margin-bottom: 0.5rem;
    }
    
    .compact-form legend {
        font-size: 0.9rem;
        margin-bottom: 0.5rem;
    }
    
    .compact-form .card-body {
        padding: 1rem;
    }
    
    /* Scrollbar styling */
    .table-responsive::-webkit-scrollbar {
        width: 6px;
        height: 6px;
    }
    
    .table-responsive::-webkit-scrollbar-track {
        background: #f1f1f1;
    }
    
    .table-responsive::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 3px;
    }
    
    .table-responsive::-webkit-scrollbar-thumb:hover {
        background: #555;
    }
</style>

<!-- Clones -->
<noscript id="service-clone">
    <tr>
        <td class="text-center">
            <button type="button" class="btn btn-sm btn-danger rounded-0 rem-service p-0 px-1"><i class="fa fa-trash"></i></button>
        </td>
        <td>
            <input type="hidden" name="service_id[]">
            <input type="text" name="service_name[]" class="form-control form-control-sm border-0 p-0 service_name_input" required>
        </td>
        <td>
            <input type="number" name="service_price[]" class="form-control form-control-sm border-0 p-0 text-right service_price_input" step="0.01" required>
        </td>
    </tr>
</noscript>

<noscript id="product-clone">
    <tr>
        <td class="text-center">
            <button type="button" class="btn btn-sm btn-danger rounded-0 rem-product p-0 px-1"><i class="fa fa-trash"></i></button>
        </td>
        <td>
            <input type="hidden" name="product_id[]">
            <input type="text" name="product_name[]" class="form-control form-control-sm border-0 p-0 product_name_input" required>
        </td>
        <td>
            <input type="number" name="product_qty[]" class="form-control form-control-sm border-0 p-0 text-center product_qty_input" min="1" value="1" required>
        </td>
        <td>
            <input type="number" name="product_price[]" class="form-control form-control-sm border-0 p-0 text-right product_price_input" step="0.01" required>
        </td>
        <td class="text-right fw-bold product_total">₹0.00</td>
    </tr>
</noscript>

<script>
// Image preview for new uploads
let selectedFiles = [];
$(document).on('click', '#browse-photos', function() {
    $('#item_photos_trigger').click();
});

$('#item_photos_trigger').on('change', function(e) {
    const newFiles = Array.from(e.target.files);
    if (newFiles.length === 0) return;

    const previewContainer = $('#image-preview');
    let addedCount = 0;

    newFiles.forEach(file => {
        if (!file.type.match('image.*')) return;

        const isDuplicate = selectedFiles.some(f => 
            f.name === file.name && f.size === file.size && f.lastModified === file.lastModified
        );

        if (!isDuplicate) {
            selectedFiles.push(file);
            addedCount++;

            const reader = new FileReader();
            reader.onload = function(ev) {
                const col = $('<div class="col-md-2 col-4 mb-2 text-center position-relative preview-item"></div>');
                const img = $('<img class="img-thumbnail" style="height:80px; width:100%; object-fit:cover; cursor:pointer;">')
                             .attr('src', ev.target.result)
                             .click(function() { viewer_modal(ev.target.result); });

                const removeBtn = $('<button type="button" class="btn btn-danger btn-xs position-absolute top-0 end-0 m-0" style="padding: 0.1rem 0.3rem; font-size: 0.7rem;">')
                                  .html('<i class="fa fa-times"></i>')
                                  .click(function() {
                                      col.fadeOut(300, function() { $(this).remove(); });
                                      selectedFiles = selectedFiles.filter(f => 
                                          f.name !== file.name || f.size !== file.size || f.lastModified !== file.lastModified
                                      );
                                      updateFileDisplay();
                                      if (selectedFiles.length === 0) previewContainer.hide();
                                  });

                col.append(img).append(removeBtn);
                previewContainer.append(col);
            };
            reader.readAsDataURL(file);
        }
    });

    if (addedCount > 0) {
        previewContainer.show();
        updateFileDisplay();
        alert_toast(addedCount + " photo(s) added", 'info');
    }

    this.value = '';
});

function updateFileDisplay() {
    if (selectedFiles.length === 0) {
        $('#file-names-display').val('').attr('placeholder', 'No photos selected');
        $('#selected-count').text('0');
        return;
    }
    $('#file-names-display').val(selectedFiles.length + ' file(s) selected');
    $('#selected-count').text(selectedFiles.length);
}

// Select2 Initialization
$(function(){
    $('#client_name, #service_sel, #product_sel, #mechanic_id').select2({
        width: '100%',
        dropdownParent: $('#transaction-form')
    });
	
	// --- ADD NEW CLIENT FEATURE ---
    $('#add_new_client').click(function(){
        // Uni-modal function system ki standard function hai jo modals open karti hai
        uni_modal("<i class='fa fa-plus'></i> Add New Client", "clients/manage_client.php", "mid-large");
    });

    // Client balance
    $('#client_name').change(function() {
        get_client_balance($(this).val());
    });
    
    if ($('#client_name').val() > 0) {
        get_client_balance($('#client_name').val());
    }

    // Add Service with editable name
    $('#add_service').click(function(){
        if(!$('#service_sel').val()) return alert("Select a service first");
        let id = $('#service_sel').val();
        if($(`#service-list input[name="service_id[]"][value="${id}"]`).length > 0) return alert("Service already added");

        let name = $('#service_sel option:selected').data('name');
        let price = $('#service_sel option:selected').data('price');
        let tr = $($('noscript#service-clone').html()).clone();

        tr.find('[name="service_id[]"]').val(id);
        tr.find('.service_name_input').val(name);
        tr.find('.service_price_input').val(price);

        $('#service-list tbody').append(tr);
        calc_total();
        $('#service_sel').val('').trigger('change');
        
        // Make name field editable on focus
        tr.find('.service_name_input').focus();
    });

    // Add Product with editable name
    $('#add_product').click(function(){
        if(!$('#product_sel').val()) return alert("Select a product first");
        let id = $('#product_sel').val();
        if($(`#product-list input[name="product_id[]"][value="${id}"]`).length > 0) return alert("Product already added");

        let name = $('#product_sel option:selected').data('name');
        let price = $('#product_sel option:selected').data('price');
        let tr = $($('noscript#product-clone').html()).clone();

        tr.find('[name="product_id[]"]').val(id);
        tr.find('.product_name_input').val(name);
        tr.find('.product_price_input').val(price);
        tr.find('.product_total').text('₹' + parseFloat(price).toLocaleString('en-IN', {minimumFractionDigits: 2}));

        $('#product-list tbody').append(tr);
        calc_total();
        $('#product_sel').val('').trigger('change');
        
        // Make name field editable on focus
        tr.find('.product_name_input').focus();
    });

    // Remove items
    $(document).on('click', '.rem-service, .rem-product', function(){
        $(this).closest('tr').remove();
        calc_total();
    });

    // Calculate total with editable names
    function calc_total(){
        let service_total = 0;
        $('#service-list .service_price_input').each(function(){
            service_total += parseFloat($(this).val()) || 0;
        });
        $('#service_total').text('₹' + service_total.toLocaleString('en-IN', {minimumFractionDigits: 2}));

        let product_total = 0;
        $('#product-list tbody tr').each(function(){
            let qty = parseFloat($(this).find('.product_qty_input').val()) || 0;
            let price = parseFloat($(this).find('.product_price_input').val()) || 0;
            let row_total = qty * price;
            $(this).find('.product_total').text('₹' + row_total.toLocaleString('en-IN', {minimumFractionDigits: 2}));
            product_total += row_total;
        });
        $('#product_total').text('₹' + product_total.toLocaleString('en-IN', {minimumFractionDigits: 2}));

        let grand = service_total + product_total;
        $('[name="amount"]').val(grand.toFixed(2));
        $('#amount').text('₹' + grand.toLocaleString('en-IN', {minimumFractionDigits: 2}));
    }

    // Recalculate on any input change
    $(document).on('input change', '.service_price_input, .product_qty_input, .product_price_input', calc_total);
    
    // Form submission
    $(document).off('submit', '#transaction-form').on('submit', '#transaction-form', function(e) {
        e.preventDefault();
        e.stopImmediatePropagation();

        var _this = $(this);
        var saveBtn = _this.find('button[type="submit"]');

        if(saveBtn.prop('disabled') == true){
            return false;
        }

        $('.err-msg').remove();

        if (!$('#client_name').val()) {
            alert_toast("Please select a client", 'warning');
            return false;
        }

        saveBtn.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Saving...');
        start_loader();

        let formData = new FormData(this);

        if (typeof selectedFiles !== 'undefined' && selectedFiles.length > 0) {
            formData.delete('images[]');
            selectedFiles.forEach((file, index) => {
                formData.append('images[]', file, file.name);
            });
        }

        $.ajax({
            url: _base_url_ + "classes/Master.php?f=save_transaction",
            data: formData,
            cache: false,
            contentType: false,
            processData: false,
            method: 'POST',
            type: 'POST',
            dataType: 'json',
            success: function(resp){
                if(resp.status == 'success'){
                    location.replace("./?page=transactions/view_details&id=" + resp.tid);
                } else if(resp.status == 'failed' && resp.msg){
                    let el = $('<div class="alert alert-danger err-msg mb-3">' + resp.msg + '</div>');
                    _this.prepend(el);
                    $("html,body").animate({scrollTop: 0}, "fast");
                    saveBtn.prop('disabled', false).html('Save Transaction'); 
                } else {
                    alert_toast("An error occurred. Please try again.", 'error');
                    saveBtn.prop('disabled', false).html('Save Transaction');
                }
                end_loader();
            },
            error: function(jqXHR, textStatus, errorThrown){
                console.log(jqXHR.responseText);
                alert_toast("Server error! Please try again.", 'error');
                saveBtn.prop('disabled', false).html('Save Transaction');
                end_loader();
            }
        });

        return false;
    });

    // Initial Total
    calc_total();
});

// Delete photo
$(document).on('click', '.delete-photo', function(){
    let photo_id = $(this).data('id');
    _conf("Delete this photo permanently?", "delete_photo", [photo_id]);
});

function delete_photo(id){
    start_loader();
    $.ajax({
        url: _base_url_ + "classes/Master.php?f=delete_transaction_image",
        method: "POST",
        data: {id: id},
        dataType: "json",
        success: function(resp){
            if(resp.status == 'success'){
                $('.delete-photo[data-id="' + id + '"]').closest('.col-md-2').fadeOut(500, function(){
                    $(this).remove();
                });
                alert_toast("Photo deleted!", 'success');
            } else {
                alert_toast("Delete failed!", 'error');
            }
            end_loader();

            if($('#uni_modal').hasClass('show')){
                $('#uni_modal').modal('hide');
            }
            else if($('#confirm_modal').hasClass('show')){
                $('#confirm_modal').modal('hide');
            }
            $('body').removeClass('modal-open');
            $('.modal-backdrop').remove();
        },
        error: function(){
            alert_toast("Server error!", 'error');
            end_loader();
            if($('#uni_modal').hasClass('show')){
                $('#uni_modal').modal('hide');
            } else if($('#confirm_modal').hasClass('show')){
                $('#confirm_modal').modal('hide');
            }
            $('body').removeClass('modal-open');
            $('.modal-backdrop').remove();
        }
    });
}

// Client balance function
function get_client_balance(client_id) {
    if (!client_id || client_id == '') {
        $('#balance-holder').hide();
        return false;
    }
    $.ajax({
        url: _base_url_ + "classes/Master.php?f=get_client_balance",
        method: 'POST',
        data: { id: client_id },
        dataType: 'json',
        error: err => {
            console.log("AJAX Error:", err);
            $('#balance-holder').hide();
        },
        success: function(resp) {
            if (resp && resp.status == 'success') {
                var formatted_balance = parseFloat(resp.balance).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });

                if($('#balance_label').length > 0){
                    $('#balance_label').text(resp.label);
                }

                var balance_el = $('#client-due-amount');
                balance_el.text('₹ ' + formatted_balance);
                balance_el.css('color', resp.color);

                if(resp.type == 'due'){
                    balance_el.addClass('text-danger').removeClass('text-success');
                } else if(resp.type == 'advance'){
                    balance_el.addClass('text-success').removeClass('text-danger');
                }

                $('#balance-holder').fadeIn();
            } else {
                $('#balance-holder').hide();
            }
        }
    });
}
</script>