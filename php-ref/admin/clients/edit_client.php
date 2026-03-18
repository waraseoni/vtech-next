<?php
require_once('../../config.php');
if(isset($_GET['id'])){
    $qry = $conn->query("SELECT * FROM `client_list` where id = '{$_GET['id']}'");
    if($qry->num_rows > 0){
        $res = $qry->fetch_array();
        foreach($res as $k => $v){
            if(!is_numeric($k))
            $$k = $v;
        }
    }
}
?>
<style>
    #cimg {
        object-fit: cover;
        height: 150px;
        width: 150px;
        border-radius: 50%;
        border: 2px solid #3498db;
        box-shadow: 0px 2px 10px rgba(0,0,0,0.1);
    }
    .custom-file-label::after {
        content: "Browse";
    }
    @media (max-width: 768px) {
        .modal-body {
            max-height: 70vh;
            overflow-y: auto;
        }
    }
</style>

<div class="container-fluid">
    <form id="client-form" enctype="multipart/form-data">
        <input type="hidden" name="id" value="<?php echo isset($id) ? $id : '' ?>">
        
        <div class="row">
            <div class="col-md-4 mb-2">
                <label class="control-label">First Name</label>
                <input type="text" name="firstname" class="form-control form-control-sm rounded-0" value="<?php echo isset($firstname) ? $firstname : '' ?>" required>
            </div>

            <div class="col-md-4 mb-2">
                <label class="control-label">Middle Name</label>
                <input type="text" name="middlename" class="form-control form-control-sm rounded-0" value="<?php echo isset($middlename) ? $middlename : '' ?>" placeholder="Optional">
            </div>

            <div class="col-md-4 mb-2">
                <label class="control-label">Last Name</label>
                <input type="text" name="lastname" class="form-control form-control-sm rounded-0" value="<?php echo isset($lastname) ? $lastname : '' ?>" required>
            </div>
            
            <div class="col-md-6 mb-2">
                <label class="control-label">Contact (Whatsapp)</label>
                <input type="text" name="contact" class="form-control form-control-sm rounded-0" value="<?php echo isset($contact) ? $contact : '' ?>" required>
            </div>
            <div class="col-md-6 mb-2">
                <label class="control-label">Email / Secondary No.</label>
                <input type="text" name="email" class="form-control form-control-sm rounded-0" value="<?php echo isset($email) ? $email : '' ?>">
            </div>

            <div class="col-md-12 mb-3">
                <label class="control-label">Address</label>
                <textarea name="address" rows="3" class="form-control form-control-sm rounded-0" required><?php echo isset($address) ? $address : '' ?></textarea>
            </div>

            <div class="col-md-12 mb-3 text-center">
                <label for="img" class="control-label d-block fw-bold">Client Photo</label>
                <div class="custom-file col-md-8 mb-2">
                    <input type="file" class="custom-file-input" id="customFile" name="img" onchange="displayImg(this,$(this))" accept="image/png, image/jpeg">
                    <label class="custom-file-label" for="customFile">Choose New Photo</label>
                </div>
                <div class="mt-2">
                    <img src="<?php echo validate_image(isset($image_path) ? $image_path : '') ?>" alt="Client Photo" id="cimg" class="img-fluid img-thumbnail">
                </div>
                <?php if(isset($image_path) && !empty($image_path)): ?>
                    <small class="text-success d-block">Current photo is loaded.</small>
                <?php endif; ?>
            </div>
        </div>
    </form>
</div>

<script>
    function displayImg(input, _this) {
        if (input.files && input.files[0]) {
            var reader = new FileReader();
            reader.onload = function (e) {
                $('#cimg').attr('src', e.target.result);
                _this.siblings('.custom-file-label').html(input.files[0].name);
            }
            reader.readAsDataURL(input.files[0]);
        }
    }

    $(function(){
        $('#client-form').submit(function(e){
            e.preventDefault();
            var _this = $(this)
            $('.pop-msg').remove()
            var el = $('<div>')
                el.addClass("pop-msg alert")
                el.hide()
            start_loader();
            $.ajax({
                url:_base_url_+"classes/Master.php?f=save_client",
                data: new FormData($(this)[0]),
                cache: false,
                contentType: false,
                processData: false,
                method: 'POST',
                type: 'POST',
                dataType: 'json',
                error:err=>{
                    console.log(err)
                    alert_toast("An error occured",'error');
                    end_loader();
                },
                success:function(resp){
                    if(resp.status == 'success'){
                        location.reload();
                    }else if(!!resp.msg){
                        el.addClass("alert-danger").text(resp.msg)
                        _this.prepend(el)
                        el.show('slow')
                    }else{
                        el.addClass("alert-danger").text("An error occurred.")
                        _this.prepend(el)
                        el.show('slow')
                    }
                    $('html,body,.modal').animate({scrollTop:0},'fast')
                    end_loader();
                }
            })
        })
    })
</script>