<?php require_once $_SERVER['DOCUMENT_ROOT'] . '/vtech-rsms/config.php'; ?>

<div class="content py-4">
    <div class="container-fluid">
        <div class="card card-outline card-primary shadow rounded-0">
            <div class="card-header rounded-0 bg-navy">
                <h3 class="card-title text-white">
                    <i class="fa fa-plus-circle"></i>
                    Create Multiple Transactions (Same Client)
                </h3>
                <div class="card-tools">
                    <a href="./?page=transactions" class="btn btn-light btn-sm border rounded-0">
                        <i class="fa fa-times"></i> Cancel
                    </a>
                </div>
            </div>

            <div class="card-body">
                <form id="multi-transaction-form" novalidate>
                    <div class="row mb-4">
                        <div class="col-md-8">
                            <label class="control-label text-navy font-weight-bold mb-1">
                                <i class="fa fa-user"></i> Client Name <span class="text-danger">*</span>
                            </label>
                            <select name="client_name" id="client_name" class="form-control form-control-sm form-control-border select2" required>
                                <option value="" disabled selected>Select Client</option>
                                <?php
                                $clients = $conn->query("SELECT *, CONCAT(firstname,' ',IFNULL(middlename,''),' ',lastname) as name FROM client_list WHERE delete_flag = 0 ORDER BY name ASC");
                                while($row = $clients->fetch_assoc()):
                                ?>
                                <option value="<?= $row['id'] ?>"><?= $row['name'] ?></option>
                                <?php endwhile; ?>
                            </select>
                        </div>
                    </div>

                    <hr class="border-primary">

                    <div id="items-container">
                        <!-- Added items will appear here -->
                    </div>

                    <!-- New Item Entry Card -->
                    <div class="card border-dashed border-primary p-4 mb-4 bg-light">
                        <h5 class="text-primary font-weight-bold mb-4">
                            <i class="fa fa-plus-circle"></i> Add New Item
                        </h5>

                        <div class="row">
                            <div class="col-md-3 mb-3">
                                <label>Jobsheet No. <span class="text-danger">*</span></label>
                                <input type="text" class="form-control form-control-sm new-item" data-field="job_id" placeholder="e.g. 27476" required>
                            </div>
                            <div class="col-md-3 mb-3">
                                <label>Assign Mechanic <span class="text-danger">*</span></label>
                                <select class="form-control form-control-sm new-item select2" data-field="mechanic_id" required>
                                    <option value="" disabled selected>Select Mechanic</option>
                                    <?php
                                    $mechanics = $conn->query("SELECT *, CONCAT(firstname,' ', COALESCE(CONCAT(middlename,' '),''), lastname) as name FROM mechanic_list WHERE delete_flag = 0 AND status = 1 ORDER BY name ASC");
                                    while($row = $mechanics->fetch_assoc()):
                                    ?>
                                    <option value="<?= $row['id'] ?>"><?= ucwords($row['name']) ?></option>
                                    <?php endwhile; ?>
                                </select>
                            </div>
                            <div class="col-md-3 mb-3">
                                <label>Item/Model <span class="text-danger">*</span></label>
                                <input type="text" class="form-control form-control-sm new-item" data-field="item" required>
                            </div>
                            <div class="col-md-3 mb-3">
                                <label>Fault Reported <span class="text-danger">*</span></label>
                                <input type="text" class="form-control form-control-sm new-item" data-field="fault" required>
                            </div>
                        </div>

                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label>Uniq ID</label>
                                <input type="text" class="form-control form-control-sm new-item" data-field="uniq_id">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label>Remarks</label>
                                <textarea class="form-control form-control-sm new-item" data-field="remark" rows="2"></textarea>
                            </div>
                        </div>

                        <div class="text-right">
                            <button type="button" id="add-item-btn" class="btn btn-primary rounded-0 px-4">
                                <i class="fa fa-plus mr-2"></i> Add This Item
                            </button>
                        </div>
                    </div>

                    <!-- Save All Button -->
                    <div class="text-center mt-4">
                        <button type="submit" id="save-all-btn" class="btn btn-success btn-lg px-5 rounded-0 shadow" disabled>
                            <i class="fa fa-save mr-2"></i> Save All Items as Separate Transactions
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>

<script>
$(function(){
    let items = [];

    // Select2 init
    $('#client_name').select2({
        width: '100%'
    });

    function initMechanicSelect2() {
        $('.new-item.select2:not(.select2-hidden-accessible)').select2({
            width: '100%',
            dropdownParent: $('#multi-transaction-form')
        });
    }

    initMechanicSelect2();

    $('#add-item-btn').click(function(){
        let valid = true;
        $('.new-item[required]').each(function(){
            if(!$(this).val() || $(this).val().toString().trim() === ''){
                valid = false;
                $(this).addClass('border-danger');
            } else {
                $(this).removeClass('border-danger');
            }
        });

        if(!valid || !$('#client_name').val()){
            alert_toast("Please fill all required fields for the new item", 'warning');
            return;
        }

        let item = {
            job_id: $('.new-item[data-field="job_id"]').val().trim(),
            mechanic_id: $('.new-item[data-field="mechanic_id"]').val(),
            item: $('.new-item[data-field="item"]').val().trim(),
            fault: $('.new-item[data-field="fault"]').val().trim(),
            uniq_id: $('.new-item[data-field="uniq_id"]').val().trim(),
            remark: $('.new-item[data-field="remark"]').val().trim()
        };

        items.push(item);

        let mechanic_name = $('.new-item[data-field="mechanic_id"] option:selected').text() || 'Not Assigned';

        let html = `
        <div class="card mb-3 border-left-primary item-entry shadow-sm">
            <div class="card-body py-3">
                <div class="row align-items-center">
                    <div class="col-md-10">
                        <p class="mb-1"><strong>Jobsheet No:</strong> ${item.job_id}</p>
                        <p class="mb-1"><strong>Mechanic:</strong> ${mechanic_name}</p>
                        <p class="mb-1"><strong>Item:</strong> ${item.item}</p>
                        <p class="mb-1"><strong>Fault:</strong> ${item.fault}</p>
                        ${item.uniq_id ? '<p class="mb-1"><strong>Uniq ID:</strong> ' + item.uniq_id + '</p>' : ''}
                        ${item.remark ? '<p class="mb-0"><strong>Remark:</strong> ' + item.remark.replace(/\n/g, '<br>') + '</p>' : ''}
                    </div>
                    <div class="col-md-2 text-right">
                        <button type="button" class="btn btn-sm btn-danger remove-item"><i class="fa fa-trash"></i></button>
                    </div>
                </div>
            </div>
        </div>`;

        $('#items-container').prepend(html);

        // Clear fields after add
        $('.new-item').val('');
        $('.new-item[data-field="mechanic_id"]').val('').trigger('change.select2');

        $('#save-all-btn').prop('disabled', false);
        alert_toast("Item added to list!", 'success');
    });

//    $(document).on('click', '.remove-item', function(){
//        let index = $(this).closest('.item-entry').index();
//        items.splice(index, 1);
//        $(this).closest('.item-entry').remove();
//        if(items.length === 0){
//            $('#save-all-btn').prop('disabled', true);
//        }
//        alert_toast("Item removed from list", 'info');
//   });
   $(document).on('click', '.remove-item', function(){
    let $entry = $(this).closest('.item-entry');
    let index = $entry.index(); // DOM order ke hisab se index
    items.splice(items.length - 1 - index, 1); // Kyuki prepend kar rahe hain, reverse index
    $entry.remove();

    if(items.length === 0){
        $('#save-all-btn').prop('disabled', true);
    }
    alert_toast("Item removed", 'info');
});

    $('#multi-transaction-form').submit(function(e){
        e.preventDefault();

        // Sirf check karo ki items list mein kuch hai ya nahi
        // New item fields ko ignore karo (kyunki wo add karne ke liye hain)
        if(items.length === 0){
            alert_toast("Please add at least one item to the list", 'warning');
            return;
        }

        if(!$('#client_name').val()){
            alert_toast("Please select a client", 'warning');
            return;
        }

        start_loader();

        let formData = new FormData();
        formData.append('client_name', $('#client_name').val());
        formData.append('items', JSON.stringify(items));

        $.ajax({
            url: _base_url_ + "classes/Master.php?f=save_multi_transaction",
            data: formData,
            cache: false,
            contentType: false,
            processData: false,
            method: 'POST',
            dataType: 'json',
            error: function(){
                alert_toast("An error occurred", 'error');
                end_loader();
            },
            success: function(resp){
                if(resp.status == 'success'){
                    alert_toast("All " + resp.count + " transactions saved successfully!", 'success');
                    
                    // Reset everything
                    items = [];
                    $('#items-container').empty();
                    $('#client_name').val('').trigger('change');
                    $('.new-item').val('');
                    $('.new-item[data-field="mechanic_id"]').val('').trigger('change.select2');
                    $('#save-all-btn').prop('disabled', true);

                    setTimeout(() => {
                        location.href = "./?page=transactions";
                    }, 2000);
                } else {
                    alert_toast(resp.msg || "Save failed", 'error');
                }
                end_loader();
            }
        });
    });
});

</script>