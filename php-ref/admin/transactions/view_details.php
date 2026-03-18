<?php 
if(isset($_GET['id'])){
    // Client ID aur full name alag-alag fetch kar rahe hain
    $qry = $conn->query("SELECT t.*, 
        t.client_name as client_id,
        CONCAT(c.firstname,' ',COALESCE(CONCAT(c.middlename,' '),''),c.lastname) as client_full_name,
        c.contact, c.address, c.email,
        CONCAT(m.firstname,' ',COALESCE(CONCAT(m.middlename,' '),''),m.lastname) as mechanic_name
        FROM `transaction_list` t 
        INNER JOIN client_list c ON t.client_name = c.id 
        LEFT JOIN mechanic_list m ON t.mechanic_id = m.id
        WHERE t.id = '{$_GET['id']}' ");
    
    if($qry->num_rows > 0){
        foreach($qry->fetch_assoc() as $k => $v){ 
            $$k = $v; 
        }
        // Display ke liye clean names
        $client_name = $client_full_name;

        // Hindi status explanation
        $status_arr = [
            0 => "Pending (Kaam shuru nahi hua hai)",
            1 => "On-Progress (Kaam chal raha hai, Jald hi ready hoga)",
            2 => "Done (Kaam pura ho gaya hai)",
            3 => "Paid (Bill chuka diya gaya hai)",
            4 => "Cancelled (Transaction radd kar diya gaya hai)",
            5 => "Delivered (Aapko item mil chuka hai)"
        ];
        $status_text = $status_arr[$status] ?? "Unknown Status";
        $color_arr = ["secondary", "primary", "info", "success", "danger", "warning"];
        $badge_color = $color_arr[$status] ?? "dark";
    } else {
        echo '<script>alert("Transaction not found."); location.replace("./?page=transactions");</script>';
        exit;
    }
} else {
    echo '<script>alert("Transaction ID required."); location.replace("./?page=transactions");</script>';
    exit;
}
?>
<style>
    /* Avatar Styling */
    .client-avatar-view {
        width: 80px;
        height: 80px;
        object-fit: cover;
        border-radius: 10px;
        border: 2px solid #01438d;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    .info-container {
        display: flex;
        align-items: center;
        gap: 20px;
    }
    
    /* Mobile Modal Fixes */
    @media (max-width: 768px) {
        .info-container {
            flex-direction: column;
            text-align: center;
        }
        
        /* Modal responsive fixes */
        .modal-dialog {
            margin: 10px !important;
            max-width: calc(100% - 20px) !important;
        }
        
        .modal-content {
            border-radius: 10px !important;
        }
        
        /* Modal footer buttons for mobile */
        .modal-footer {
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: wrap !important;
            justify-content: center !important;
            gap: 10px !important;
            padding: 15px !important;
            background-color: #f8f9fa !important;
            border-top: 1px solid #dee2e6 !important;
        }
        
        .modal-footer .btn {
            flex: 1 !important;
            min-width: 120px !important;
            margin: 5px !important;
            padding: 10px 15px !important;
            font-size: 16px !important;
        }
        
        /* Ensure modal body is scrollable on mobile */
        .modal-body {
            max-height: 60vh !important;
            overflow-y: auto !important;
            padding: 20px !important;
        }
    }
    
    /* Extra small devices */
    @media (max-width: 576px) {
        .modal-footer .btn {
            min-width: 100px !important;
            font-size: 14px !important;
            padding: 8px 12px !important;
        }
        
        .btn-lg {
            padding: 10px 16px !important;
            font-size: 16px !important;
        }
    }
    
    /* Print button fix */
    #print_page {
        background-color: #ffffff;
        border: 1px solid #ddd;
    }
    
    /* Action buttons container */
    .action-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        justify-content: center;
    }
    
    @media (max-width: 768px) {
        .action-buttons .btn {
            flex: 1 1 calc(50% - 10px);
            min-width: 140px;
            margin-bottom: 10px;
        }
    }
</style>
<div class="content py-4">
    <div class="container-fluid">
        <div class="card card-outline card-primary shadow rounded-0">
            <div class="card-header bg-navy text-white rounded-0">
                <h3 class="card-title mb-0">
                    <i class="fa fa-receipt"></i>
                    <b> Transaction Details - <?= $job_id ?> (<?= $code ?>)</b>
                </h3>
                <div class="card-tools">
                    <a href="./?page=clients/view_client&id=<?= $client_id ?>" class="btn btn-info btn-sm">
                        <i class="fa fa-user"></i> View Client
                    </a>
                    <a href="../pdf/gst_bill.php?type=transaction&id=<?= $id ?>" target="_blank" class="btn btn-success btn-sm mx-1">
                        <i class="fa fa-file-invoice"></i> GST Bill
                    </a>
                    <a href="../pdf/bill_template.php?job_id=<?= $job_id ?>" target="_blank" class="btn btn-primary btn-sm mx-1">
                        <i class="fa fa-print"></i> Print Bill
                    </a>
                    <a href="./?page=transactions" class="btn btn-light btn-sm border">
                        <i class="fa fa-angle-left"></i> Back to List
                    </a>
                </div>
            </div>

            <div class="card-body">
                <div class="row">
                    <div class="col-md-7 border-right border-primary">
                        <!-- Client Info -->
                        <div class="row mb-4">
                            <div class="col-md-6">
    <fieldset class="border p-3 rounded-0 bg-light">
        <legend class="text-primary h5"><b>Client Information</b></legend>
        
        <div class="info-container p-2">
            <div class="avatar-wrapper">
                <?php 
                    // Client ki image path fetch karna (database query mein image_path pehle se honi chahiye)
                    // Agar query mein image_path nahi hai to aap ise fetch kar sakte hain
                    $c_img = $conn->query("SELECT image_path FROM client_list WHERE id = '{$client_id}'")->fetch_assoc()['image_path'];
                ?>
                <img src="<?= validate_image($c_img) ?>" 
                     alt="Client Photo" 
                     class="client-avatar-view"
                     onerror="this.src='<?php echo base_url ?>dist/img/no-image-available.png'">
            </div>

            <div class="details-wrapper">
                <p class="mb-1">
                    <b><i class="fa fa-user text-muted"></i> Name:</b> 
                    <a href="./?page=clients/view_client&id=<?= $client_id ?>" class="text-primary font-weight-bold">
                        <?= $client_full_name ?>
                    </a>
                </p>
                <p class="mb-1">
                    <b><i class="fa fa-phone-alt text-muted"></i> Contact:</b> 
                    <a href="tel:<?= $contact ?>"><?= $contact ?></a>
                </p>
                <p class="mb-1">
                    <b><i class="fa fa-map-marker-alt text-muted"></i> Address:</b> 
                    <span class="text-muted small"><?= $address ?></span>
                </p>
            </div>
        </div>
    </fieldset>
</div>
                            <div class="col-md-6">
                                <fieldset class="border p-3 rounded-0 bg-light">
                                    <legend class="w-auto text-primary font-weight-bold px-2"><i class="fa fa-tools"></i> Job Details</legend>
                                    <p class="mb-1"><b>Mechanic:</b> <?= $mechanic_name ?: '<em class="text-muted">Not Assigned</em>' ?></p>
                                    <p class="mb-1"><b>Received:</b> <?= date("d M Y h:i A", strtotime($date_created)) ?></p>
									<p class="mb-0"><b>Job No.</b> <?= $job_id ?></p>
									<p class="mb-0"><b>Code:</b> <?= $code ?></p>
                                    <p class="mb-1"><b>Locate Here:</b> <?= $uniq_id ?: '<em class="text-muted">N/A</em>' ?></p>
                                </fieldset>
                            </div>
                        </div>

                        <!-- Item Description -->
                        <fieldset class="border p-3 rounded-0 bg-light mb-4">
                            <legend class="w-auto text-primary font-weight-bold px-2"><i class="fa fa-box"></i> Item Description</legend>
                            <p class="mb-1"><b>Item/Model:</b> <?= $item ?></p>
                            <p class="mb-1"><b>Fault Reported:</b><br><?= nl2br($fault) ?></p>
                            <p class="mb-0"><b>Remarks:</b><br><?= nl2br($remark ?: '<em class="text-muted">No remarks</em>') ?></p>
                        </fieldset>

                        <!-- Services Table -->
                        <?php 
                        $services = $conn->query("SELECT ts.*, s.name as service_name FROM transaction_services ts INNER JOIN service_list s ON ts.service_id = s.id WHERE ts.transaction_id = '$id'");
                        if($services->num_rows > 0):
                        ?>
                        <fieldset class="border p-3 rounded-0 bg-light mb-4">
                            <legend class="w-auto text-primary font-weight-bold px-2"><i class="fa fa-wrench"></i> Services Availed</legend>
                            <div class="table-responsive">
                                <table class="table table-bordered table-striped">
                                    <thead class="bg-navy text-white">
                                        <tr>
                                            <th>Service</th>
                                            <th class="text-right">Charge</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php while($row = $services->fetch_assoc()): ?>
                                        <tr>
                                            <td><?= $row['service_name'] ?></td>
                                            <td class="text-right">₹<?= number_format($row['price'], 2) ?></td>
                                        </tr>
                                        <?php endwhile; ?>
                                    </tbody>
                                </table>
                            </div>
                        </fieldset>
                        <?php endif; ?>

                        <!-- Products Table -->
                        <?php 
                        $products = $conn->query("SELECT tp.*, p.name as product_name FROM transaction_products tp INNER JOIN product_list p ON tp.product_id = p.id WHERE tp.transaction_id = '$id'");
                        if($products->num_rows > 0):
                            $prod_total = 0;
                        ?>
                        <fieldset class="border p-3 rounded-0 bg-light mb-4">
                            <legend class="w-auto text-success font-weight-bold px-2"><i class="fa fa-shopping-cart"></i> Products Used</legend>
                            <div class="table-responsive">
                                <table class="table table-bordered table-striped">
                                    <thead class="bg-success text-white">
                                        <tr>
                                            <th>Product</th>
                                            <th class="text-center">Qty</th>
                                            <th class="text-right">Price</th>
                                            <th class="text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php while($row = $products->fetch_assoc()): 
                                            $row_total = $row['qty'] * $row['price'];
                                            $prod_total += $row_total;
                                        ?>
                                        <tr>
                                            <td><?= $row['product_name'] ?></td>
                                            <td class="text-center"><?= $row['qty'] ?></td>
                                            <td class="text-right">₹<?= number_format($row['price'], 2) ?></td>
                                            <td class="text-right">₹<?= number_format($row_total, 2) ?></td>
                                        </tr>
                                        <?php endwhile; ?>
                                    </tbody>
                                    <tfoot>
                                        <tr class="bg-light font-weight-bold">
                                            <th colspan="3" class="text-right">Products Total:</th>
                                            <th class="text-right">₹<?= number_format($prod_total, 2) ?></th>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </fieldset>
                        <?php endif; ?>
                    </div>

                    <!-- Right Side -->
                    <div class="col-md-5">
    <div class="text-center mb-4">
        <label class="text-muted d-block font-weight-bold">Current Job Status</label>
        <span class="badge badge-<?= $badge_color ?> p-4 shadow-sm rounded-0" style="font-size:1.8rem; min-width:90%;">
            <?= explode(" (", $status_text)[0] ?>
        </span>
        <small class="d-block mt-2 text-muted font-weight-medium">
            <?= explode(" (", $status_text)[1] ?? '' ?>
        </small>

        <?php if($status == 5 && !empty($date_completed)): ?>
            <div class="mt-3 text-success border-top pt-2">
                <i class="fas fa-check-circle"></i> 
                <b>Delivered On:</b><br>
                <span style="font-size: 1.2rem;"><?= date("d M Y, h:i A", strtotime($date_completed)) ?></span>
            </div>
        <?php endif; ?>
        </div>
						
						<!-- Item Photos Gallery -->
<?php 
$img_qry = $conn->query("SELECT * FROM transaction_images WHERE transaction_id = '$id' ORDER BY date_created DESC");
if($img_qry->num_rows > 0):
?>
<fieldset class="border p-3 rounded-0 bg-light mb-4">
    <legend class="w-auto text-primary font-weight-bold px-2">
        <i class="fa fa-images"></i> Item Photos
    </legend>
    <div class="row">
        <?php while($img = $img_qry->fetch_assoc()): 
            $img_path = base_url . 'uploads/transactions/' . basename($img['image_path']);
        ?>
        <div class="col-md-4 mb-3 text-center">
            <a href="<?= $img_path ?>" target="_blank">
                <img src="<?= $img_path ?>" class="img-fluid img-thumbnail" style="max-height:250px; object-fit:cover;">
            </a>
        </div>
        <?php endwhile; ?>
    </div>
</fieldset>
<?php endif; ?>

                        <div class="card border-success shadow-sm rounded-0 mb-4">
                            <div class="card-body bg-light text-center">
                                <h5 class="text-success font-weight-bold mb-3">Billing Summary</h5>
                                <div class="d-flex justify-content-between py-2 border-bottom">
                                    <span class="font-weight-medium">Total Amount:</span>
                                    <b class="h4 mb-0">₹<?= number_format($amount, 2) ?></b>
                                </div>
                                <div class="mt-3">
                                    <h3 class="text-success font-weight-bold mb-0">₹<?= number_format($amount, 2) ?></h3>
                                    <small class="text-muted">Final Payable Amount</small>
                                </div>
                            </div>
                        </div>

                        <div class="text-center">
                            <button class="btn btn-success btn-lg btn-block shadow-sm" onclick="sendWA_status()">
                                <i class="fab fa-whatsapp fa-lg"></i> Send Status on WhatsApp
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Bottom Action Buttons -->
                <hr class="my-10 border-primary">
                <div class="action-buttons">
                    <button class="btn btn-primary btn-lg shadow-sm" id="update_status">
                        <i class="fa fa-sync"></i> Update Status
                    </button>
                    <a href="./?page=transactions/manage_transaction&id=<?= $id ?>" class="btn btn-info btn-lg shadow-sm">
                        <i class="fa fa-edit"></i> Edit Transaction
                    </a>
                    <button class="btn btn-light btn-lg border shadow-sm" id="print_page">
                        <i class="fa fa-print"></i> Print Page
                    </button>
					<button type="button" class="btn btn-success btn-lg shadow-sm add_payment" data-client-id="<?= $client_id ?>">
						<i class="fa fa-plus"></i> Add Payment
					</button>
                    <button class="btn btn-danger btn-lg shadow-sm" id="delete_transaction">
                        <i class="fa fa-trash"></i> Delete Transaction
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
// Function to make modal responsive
function makeModalResponsive() {
    if ($(window).width() < 768) {
        $('.modal').addClass('mobile-modal');
        $('.modal-dialog').addClass('modal-dialog-centered');
        $('.modal-footer').css({
            'display': 'flex',
            'flex-direction': 'row',
            'flex-wrap': 'wrap',
            'justify-content': 'center',
            'gap': '10px'
        });
        $('.modal-footer .btn').css({
            'flex': '1',
            'min-width': '120px',
            'margin': '5px'
        });
    } else {
        $('.modal').removeClass('mobile-modal');
    }
}

// Call function on load and resize
$(document).ready(function() {
    makeModalResponsive();
    $(window).resize(makeModalResponsive);
});

function sendWA_status() {
    let client_name = "<?= addslashes($client_name) ?>";
    let item = "<?= addslashes($item) ?>";
    let job_id = "<?= $job_id ?>";
    let code = "<?= $code ?>";
    let amount = "<?= number_format($amount, 2) ?>";
    let status = "<?= $status ?>"; // Status numerical value (0,1,2,3,4)
    let phone = "<?= preg_replace('/\D/', '', $contact ?? '') ?>";
    let tid = "<?= $id ?>";
    let business_name = "Vikram Jain, V-Technologies, Jabalpur, Mob.-9179105875";

    if(phone.length < 10) {
        alert("Valid mobile number नहीं मिला!");
        return;
    }

    let msg = "";
    let base_msg = `Namaste ${client_name} ji 🙏!\n\n`;

    // Status ke hisaab se message chunna
    switch (parseInt(status)) {
        case 0: // Pending
            msg = base_msg + 
                  `आपका *${item}* (Job ID: ${job_id}) repair के लिए प्राप्त हुआ है। 📝\n\n` +
                  `Status: *Pending (Queue में है)*\n` +
                  `हम जल्द ही चेक करके आपको अपडेट देंगे।\n\n` +
                  `धन्यवाद ❤️\n${business_name}`;
            break;

        case 1: // In Progress
            msg = base_msg + 
                  `आपके *${item}* (Job ID: ${job_id}) पर काम शुरू कर दिया गया है। 🛠️\n\n` +
                  `Status: *On-Progress (काम चल रहा है)*\n` +
                  `कृपया धैर्य रखें, हम बेहतरीन सर्विस सुनिश्चित कर रहे हैं।\n\n` +
                  `धन्यवाद ❤️\n${business_name}`;
            break;

        case 2: // Done / Ready
            msg = base_msg + 
                  `आपका *${item}* repair complete हो गया है ✅\n\n` +
                  `📋 *Details:*\n` +
                  `Job ID: ${job_id}\n` +
                  `Code: ${code}\n` +
                  `Total Bill: *₹${amount}*\n` +
                  `Status: *Ready for Delivery*\n\n` +
                  `आप अपना device collect कर सकते हैं। स्वागत है!\n\n` +
                  `धन्यवाद ❤️\n${business_name}`;
            break;

        case 3: // Paid / Delivered
            msg = base_msg + 
                  `आपका *${item}* (Job ID: ${job_id}) सफलतापूर्वक deliver कर दिया गया है। 🏁\n\n` +
                  `Status: *Paid *\n` +
                  `Payment: *₹${amount}*\n\n` +
                  `V-Technologies पर भरोसा करने के लिए धन्यवाद! अपना फीडबैक जरूर दें। ⭐\n\n` +
                  `${business_name}`;
            break;

        case 4: // Cancelled
            msg = base_msg + 
                  `आपका Job ID: ${job_id} (*${item}*) का order *Cancel* कर दिया गया है। ❌\n\n` +
                  `कृपया अधिक जानकारी के लिए हमसे संपर्क करें।\n\n` +
                  `धन्यवाद 🙏\n${business_name}`;
            break;
			
		case 5: // Paid / Delivered
            msg = base_msg + 
                  `आपका *${item}* (Job ID: ${job_id}) सफलतापूर्वक deliver कर दिया गया है। 🏁\n\n` +
                  `Status: *Delivered*\n` +
                  `Payment: *₹${amount}*\n\n` +
                  `V-Technologies पर भरोसा करने के लिए धन्यवाद! अपना फीडबैक जरूर दें। ⭐\n\n` +
                  `${business_name}`;
            break;	

        default:
            msg = base_msg + `आपके Item: ${item} (Job ID: ${job_id}) का स्टेटस अपडेट हुआ है। कृपया चेक करें।`;
    }

    // WhatsApp Web open
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

$(function(){
    // Update status modal with responsive settings
    $('#update_status').click(function(){
        uni_modal("Update Transaction Status", "transactions/update_status.php?id=<?= $id ?>", 'modal-lg');
    });

    // Print page
    $('#print_page').click(function(){
        window.open("transactions/print_invoice.php?id=<?php echo $id ?>", "_blank");
    });
	
	// Add payment modal with responsive settings
	$('.add_payment').click(function(){
        var client_id = $(this).attr('data-client-id');
        // Mobile view ke liye modal size adjust karna
        var modalSize = $(window).width() < 768 ? '' : 'modal-lg';
        uni_modal("Record New Payment", "clients/edit_payment.php?client_id=" + client_id, modalSize);
    });

    // Delete transaction
    $('#delete_transaction').click(function(){
        _conf("Are you sure to delete this transaction permanently?", "delete_transaction", ['<?= $id ?>']);
    });
    
    // Ensure modal buttons are visible on mobile
    $(document).on('shown.bs.modal', function() {
        makeModalResponsive();
    });
});

function delete_transaction(id){
    start_loader();
    $.ajax({
        url: _base_url_ + "classes/Master.php?f=delete_transaction",
        method: "POST",
        data: {id: id},
        dataType: "json",
        success: function(resp){
            if(resp.status == 'success'){
                location.replace('./?page=transactions');
                alert_toast("Transaction deleted successfully", 'success');
            } else {
                alert_toast("An error occurred", 'error');
            }
            end_loader();
        }
    });
}
</script>