<?php 
// Fetch Next expected Job ID for display purpose only
$last_job_qry = $conn->query("SELECT last_job_id FROM job_id_counter");
$next_job_id = ($last_job_qry->num_rows > 0) ? $last_job_qry->fetch_assoc()['last_job_id'] + 1 : 27652;
?>

<style>
    /* Desktop Table View */
    @media (min-width: 768px) {
        .mobile-card-container { display: none; }
    }

    /* Mobile Card View */
    @media (max-width: 767px) {
        .desktop-table-view { display: none; }
        .mobile-card-container { display: block; }
        .item-card {
            background: #fff;
            border: 1px solid #ddd;
            border-left: 5px solid #28a745;
            margin-bottom: 15px;
            padding: 15px;
            border-radius: 5px;
            position: relative;
        }
        .card-row-num {
            position: absolute;
            top: 5px;
            right: 10px;
            font-weight: bold;
            color: #ccc;
        }
    }

    /* Common Styles */
    .form-control-sm { border-radius: 0; }
    .select2-container .select2-selection--single { height: 38px !important; }
</style>

<div class="content py-3">
    <div class="container-fluid">
        <div class="card card-outline card-success shadow rounded-0">
            <div class="card-header rounded-0 bg-navy">
                <h3 class="card-title text-white">
                    <i class="fa fa-layer-group"></i> <b>Bulk Entry (Mobile Responsive)</b>
                </h3>
                <div class="card-tools">
                    <a href="./?page=transactions" class="btn btn-light btn-sm border rounded-0">
                        <i class="fa fa-times"></i> Cancel
                    </a>
                </div>
            </div>
            
            <div class="card-body">
                <form id="bulk-transaction-form">
                    
                    <div class="row mb-4 p-3 bg-light border mx-0">
                        <div class="col-md-5 mb-2">
                            <label class="font-weight-bold text-navy">Select Client *</label>
                            <select name="client_name" id="client_name" class="form-control select2" required>
                                <option value="" disabled selected>Search Client...</option>
                                <?php 
                                $clients = $conn->query("SELECT *, CONCAT(firstname,' ',IFNULL(middlename,''),' ',lastname) as name FROM client_list WHERE delete_flag = 0 ORDER BY name ASC");
                                while($row = $clients->fetch_assoc()):
                                ?>
                                <option value="<?= $row['id'] ?>"><?= $row['name'] ?></option>
                                <?php endwhile; ?>
                            </select>
                        </div>
                        <div class="col-md-4 mb-2">
                            <label class="font-weight-bold text-navy">Default Mechanic</label>
                            <select id="global_mechanic" class="form-control select2">
                                <option value="">Select Default Mechanic</option>
                                <?php 
                                $mechs = $conn->query("SELECT *, CONCAT(firstname,' ',lastname) as name FROM mechanic_list WHERE delete_flag = 0 AND status = 1 ORDER BY name ASC");
                                while($row = $mechs->fetch_assoc()):
                                ?>
                                <option value="<?= $row['id'] ?>"><?= $row['name'] ?></option>
                                <?php endwhile; ?>
                            </select>
                        </div>
                        <div class="col-md-3 text-md-right align-self-end mb-2">
                            Next ID: <span class="badge badge-warning" id="start_job_id"><?= $next_job_id ?></span>
                        </div>
                    </div>

                    <div class="desktop-table-view table-responsive">
                        <table class="table table-bordered" id="bulk-table">
                            <thead class="bg-success text-white">
                                <tr>
                                    <th>#</th>
                                    <th>Job ID</th>
                                    <th>Item *</th>
                                    <th>Fault *</th>
                                    <th>Assign To</th>
                                    <th>Unique ID</th>
                                    <th><i class="fa fa-trash"></i></th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>

                    <div class="mobile-card-container" id="mobile-list">
                        </div>

                    <div class="row mt-4 border-top pt-3">
                        <div class="col-6">
                            <button type="button" class="btn btn-info btn-flat btn-block" id="add_row_btn">
                                <i class="fa fa-plus"></i> Add Item
                            </button>
                        </div>
                        <div class="col-6 text-right">
                            <button type="submit" class="btn btn-primary btn-flat btn-block" id="save_all_btn">
                                <i class="fa fa-save"></i> Save All
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>

<script>
    // Mechanic options string
    var mechanics_opts = '<option value="">Select Mechanic</option>';
    <?php 
    $mechs->data_seek(0);
    while($row = $mechs->fetch_assoc()): ?>
        mechanics_opts += '<option value="<?= $row['id'] ?>"><?= addslashes($row['name']) ?></option>';
    <?php endwhile; ?>

    var base_job_id = <?= $next_job_id ?>;

    function add_new_item() {
        var row_idx = $('#bulk-table tbody tr').length;
        var current_job_id = base_job_id + row_idx;
        var default_mech = $('#global_mechanic').val();

        // 1. Table Row (For Desktop)
        var tr = `
            <tr class="item-entry" data-index="${row_idx}">
                <td class="text-center row-num">${row_idx + 1}</td>
                <td><input type="text" class="form-control bg-light job-id-display" readonly value="${current_job_id}"></td>
                <td><input type="text" class="form-control item-input" required></td>
                <td><input type="text" class="form-control fault-input" required></td>
                <td><select class="form-control row-mechanic">${mechanics_opts}</select></td>
                <td><input type="text" class="form-control uniq-input"></td>
                <td class="text-center"><button type="button" class="btn btn-sm btn-danger remove-item"><i class="fa fa-times"></i></button></td>
            </tr>`;

        // 2. Card (For Mobile)
        var card = `
            <div class="item-card item-entry" data-index="${row_idx}">
                <span class="card-row-num">#${row_idx + 1}</span>
                <div class="form-group mb-2">
                    <label class="small mb-0">Job ID</label>
                    <input type="text" class="form-control form-control-sm bg-light job-id-display" readonly value="${current_job_id}">
                </div>
                <div class="form-group mb-2">
                    <label class="small mb-0">Item / Model *</label>
                    <input type="text" class="form-control form-control-sm item-input" required>
                </div>
                <div class="form-group mb-2">
                    <label class="small mb-0">Fault Reported *</label>
                    <input type="text" class="form-control form-control-sm fault-input" required>
                </div>
                <div class="row">
                    <div class="col-7">
                        <label class="small mb-0">Mechanic</label>
                        <select class="form-control form-control-sm row-mechanic">${mechanics_opts}</select>
                    </div>
                    <div class="col-5">
                        <label class="small mb-0">Uniq ID</label>
                        <input type="text" class="form-control form-control-sm uniq-input">
                    </div>
                </div>
                <button type="button" class="btn btn-sm btn-outline-danger btn-block mt-3 remove-item"><i class="fa fa-trash"></i> Remove This Item</button>
            </div>`;

        var $tr = $(tr);
        var $card = $(card);

        if(default_mech) {
            $tr.find('.row-mechanic').val(default_mech);
            $card.find('.row-mechanic').val(default_mech);
        }

        $('#bulk-table tbody').append($tr);
        $('#mobile-list').append($card);

        // Sync inputs between Table and Card
        sync_inputs(row_idx);
    }

    // Function to keep Table and Card data the same
    function sync_inputs(index) {
        $(`.item-entry[data-index="${index}"] input, .item-entry[data-index="${index}"] select`).on('input change', function() {
            var className = $(this).attr('class').split(' ').filter(c => c.includes('-input') || c.includes('row-mechanic'))[0];
            $(`.item-entry[data-index="${index}"] .${className}`).val($(this).val());
        });
    }

    $(document).ready(function(){
        $('.select2').select2({width:'100%'});
        add_new_item(); // Initial row

        $('#add_row_btn').click(function(){ add_new_item(); });

        $(document).on('click', '.remove-item', function(){
            var idx = $(this).closest('.item-entry').data('index');
            $(`.item-entry[data-index="${idx}"]`).remove();
            reindex();
        });

        function reindex() {
            $('.desktop-table-view tbody tr').each(function(i){
                $(this).attr('data-index', i).find('.row-num').text(i+1);
                $(this).find('.job-id-display').val(base_job_id + i);
            });
            $('.mobile-card-container .item-card').each(function(i){
                $(this).attr('data-index', i).find('.card-row-num').text('#'+(i+1));
                $(this).find('.job-id-display').val(base_job_id + i);
            });
        }

        $('#bulk-transaction-form').submit(function(e){
            e.preventDefault();
            var data = [];
            // We can pick data from either table or cards (they are synced)
            $('#bulk-table tbody tr').each(function(){
                var row = $(this);
                if(row.find('.item-input').val()) {
                    data.push({
                        item: row.find('.item-input').val(),
                        fault: row.find('.fault-input').val(),
                        mechanic_id: row.find('.row-mechanic').val(),
                        uniq_id: row.find('.uniq-input').val()
                    });
                }
            });

            if(data.length == 0) return alert_toast("Add at least one item", "warning");

            start_loader();
            $.ajax({
                url: _base_url_+"classes/Master.php?f=save_multi_transaction",
                method: 'POST',
                data: { client_name: $('#client_name').val(), items: JSON.stringify(data) },
                dataType: 'json',
                success: function(resp){
                    if(resp.status == 'success') location.replace('./?page=transactions');
                    else { alert_toast(resp.msg, "error"); end_loader(); }
                }
            });
        });
    });
</script>