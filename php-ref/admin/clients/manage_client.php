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
    #cimg{
        object-fit:scale-down;
        object-position:center center;
        height:200px;
        width:200px;
    }
    .client-card {
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        padding: 25px;
        margin: 20px auto;
        max-width: 900px;
        border: 1px solid #e0e0e0;
    }
    .card-header {
        font-size: 1.4rem;
        font-weight: 600;
        color: #2c3e50;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid #3498db;
    }
	/* मोबाइल पर मॉडल को सही दिखाने के लिए */
		@media (max-width: 768px) {
    .modal-body {
        max-height: 70vh; /* स्क्रीन की 70% ऊंचाई तक ही सीमित रखें */
        overflow-y: auto; /* अगर फॉर्म बड़ा है तो अंदर स्क्रॉल आए */
    }
}
</style>

<div class="content py-3">
    <div class="container-fluid">

        <!-- मोबाइल के लिए भी परफेक्ट कार्ड -->
        <div class="bg-white rounded-3 shadow-lg p-4 p-md-5" style="max-width:950px; margin:0 auto; border:1px solid #e2e8f5;">

            <form id="client-form" class="needs-validation" novalidate>
                <input type="hidden" name="id" value="<?php echo isset($id) ? $id : '' ?>">

                <div class="row g-3 g-md-4">

                    <!-- First Name -->
                    <div class="col-12 col-md-6">
                        <label class="form-label fw-bold">First Name <span class="text-danger">*</span></label>
                        <input type="text" name="firstname" class="form-control rounded-3" 
                               style="height:48px; font-size:1rem;" placeholder="First name"
                               value="<?php echo isset($firstname) ? $firstname : '' ?>" required>
                        <div class="invalid-feedback">First name is required</div>
                    </div>

                    <!-- Middle Name -->
                    <div class="col-12 col-md-6">
                        <label class="form-label fw-bold">Middle Name <small class="text-muted">(optional)</small></label>
                        <input type="text" name="middlename" class="form-control rounded-3" 
                               style="height:48px;" placeholder="Middle name"
                               value="<?php echo isset($middlename) ? $middlename : '' ?>">
                    </div>

                    <!-- Last Name -->
                    <div class="col-12 col-md-6">
                        <label class="form-label fw-bold">Last Name <span class="text-danger">*</span></label>
                        <input type="text" name="lastname" class="form-control rounded-3" 
                               style="height:48px;" placeholder="Last name"
                               value="<?php echo isset($lastname) ? $lastname : '' ?>" required>
                        <div class="invalid-feedback">Last name is required</div>
                    </div>
					<div class="col-md-6">
						<label for="opening_balance" class="control-label">Opening Balance (Old Due/Advance)</label>
						<input type="number" step="0.01" name="opening_balance" id="opening_balance" class="form-control form-control-sm rounded-0 text-right" value="<?= isset($opening_balance) ? $opening_balance : '0.00' ?>">
							<small>Positive = Due from client, Negative = Advance</small>
					</div>

                    <!-- Whatsapp No. -->
                    <div class="col-12 col-md-6">
                        <label class="form-label fw-bold">Whatsapp No. <span class="text-danger">*</span></label>
                        <input type="text" name="contact" class="form-control rounded-3" 
                               style="height:48px;" placeholder="98xxxxxxxxxx" 
                               pattern="[0-9]{10}" maxlength="10"
                               value="<?php echo isset($contact) ? $contact : '' ?>" required>
                        <div class="invalid-feedback">Enter valid 10-digit number</div>
                    </div>

                    <!-- Email / Mobile -->
                    <div class="col-12">
                        <label class="form-label fw-bold">Email or Mobile <small class="text-muted">(optional)</small></label>
                        <input type="text" name="email" class="form-control rounded-3" 
                               style="height:48px;" placeholder="example@gmail.com or 98xxxxxxxxxx"
                               pattern="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$|^[0-9]{10}$"
                               value="<?php echo isset($email) ? $email : '' ?>">
                        <div class="invalid-feedback">Enter valid email or 10-digit mobile</div>
                    </div>

                    <!-- Address -->
                    <div class="col-12">
                        <label class="form-label fw-bold">Address <span class="text-danger">*</span></label>
                        <textarea name="address" rows="4" class="form-control rounded-3" 
                                  style="resize:none; font-size:1rem;" placeholder="Complete address..." required><?php echo isset($address) ? $address : '' ?></textarea>
                        <div class="invalid-feedback">Address is required</div>
                    </div>
					
					<div class="form-group">
						<label for="image" class="control-label">Client Photo</label>
						<div class="custom-file">
							<input type="file" class="custom-file-input rounded-circle" id="customFile" name="img" onchange="displayImg(this,$(this))" accept="image/png, image/jpeg">
							<label class="custom-file-label" for="customFile">Choose file</label>
						</div>
					</div>
<div class="form-group d-flex justify-content-center">
    <img src="<?php echo validate_image(isset($image_path) ? $image_path : '') ?>" alt="" id="cimg" class="img-fluid img-thumbnail" style="width: 150px; height: 150px; object-fit: cover;">
</div>
					
                </div>
				<div class="col-12 d-md-none mt-4 mb-3">
    <button type="submit" form="client-list-main" class="btn btn-primary btn-block mb-2" onclick="$('#client-form').submit()">Save Client</button>
    <button type="button" class="btn btn-default btn-block" data-dismiss="modal">Cancel</button>
</div>
            </form>
        </div>
    </div>
</div>

<!-- मोबाइल + डेस्कटॉप दोनों के लिए परफेक्ट स्क्रिप्ट -->
<style>
    /* मोबाइल पर कोई भी horizontal overflow नहीं होने देगा */
    .content { overflow-x: hidden; }
    .form-control, .form-label { font-size: 1rem !important; }
    @media (max-width: 480px) {
        .rounded-3 { border-radius: 12px !important; }
        .p-4 { padding: 1.25rem !important; }
    }
</style>

<script>
$(function(){
    // Bootstrap validation
    var form = document.getElementById('client-form');
    
    $('#client-form').on('submit', function(e){
        e.preventDefault();

        if (!form.checkValidity()) {
            e.stopPropagation();
            form.classList.add('was-validated');
            alert_toast("Please fill all required fields correctly.", "error");
            return false;
        }

        form.classList.add('was-validated');
        start_loader();

        $.ajax({
            url: _base_url_ + "classes/Master.php?f=save_client",
            data: new FormData(this),
            cache: false,
            contentType: false,
            processData: false,
            method: 'POST',
            dataType: 'json',
            success: function(resp){
                if(resp.status == 'success'){
                    location.reload();
                } else {
                    alert_toast(resp.msg || "An error occurred", "error");
                }
                end_loader();
            },
            error: function(){
                alert_toast("An error occurred", "error");
                end_loader();
            }
        });
    });
});
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
</script>
<script>
success:function(resp){
    if(resp.status == 'success'){
        location.reload();
    } else {
        if(resp.msg){
            alert_toast(resp.msg, 'error');
        } else {
            alert_toast("An error occurred.", 'error');
        }
    }
    end_loader();  // ← ये हर हाल में चलना चाहिए!
},
error:function(){
    alert_toast("An error occurred", 'error');
    end_loader();  // ← ये भी जरूरी है
}
</script>
<!-- Bootstrap 5 Validation Script (ये जरूर डालना) -->
<script>
    $(function(){
        // Bootstrap 5 की validation activate करो
        var form = document.getElementById('client-form');
        form.addEventListener('submit', function(event) {
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
            }
            form.classList.add('was-validated');
        }, false);

        // अब आपका AJAX वाला कोड (जो पहले से है) – बस थोड़ा modify
        $('#client-form').submit(function(e){
            e.preventDefault();

            // अगर validation fail हुआ तो AJAX मत चलाओ
            if (!form.checkValidity()) {
                form.classList.add('was-validated');
                alert_toast("Please fill all required fields correctly.", "error");
                return false;
            }

            var _this = $(this);
            $('.pop-msg').remove();
            var el = $('<div>');
            el.addClass("pop-msg alert").hide();

            start_loader();

            $.ajax({
                url: _base_url_ + "classes/Master.php?f=save_client",
                data: new FormData($(this)[0]),
                cache: false,
                contentType: false,
                processData: false,
                method: 'POST',
                dataType: 'json',
                error: function(err){
                    console.log(err);
                    alert_toast("An error occurred", 'error');
                    end_loader();
                },
                success: function(resp){
                    if(resp.status == 'success'){
                        location.reload();
                    } else if(resp.msg){
                        el.addClass("alert-danger").text(resp.msg);
                        _this.prepend(el);
                        el.show('slow');
                        $('html,body,.modal').animate({scrollTop:0},'fast');
                    } else {
                        el.addClass("alert-danger").text("An unknown error occurred.");
                        _this.prepend(el);
                        el.show('slow');
                    }
                    end_loader();
                }
            });
        });
    });
</script>

<!-- Script same rahega -->
<script>
    $(function(){
        $('#uni_modal #client-form').submit(function(e){
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
                    }else{
                        el.addClass("alert-danger").text("An error occurred.")
                        _this.prepend(el)
                    }
                    el.show('slow')
                    $('html,body,.modal').animate({scrollTop:0},'fast')
                    end_loader();
                }
            })
        })
    })
</script>
<script>
$(function(){
    // फॉर्म सबमिशन हैंडलर
    $('#client-form').submit(function(e){
        e.preventDefault();
        
        // वैलिडेशन चेक
        if (!this.checkValidity()) {
            $(this).addClass('was-validated');
            return false;
        }

        var _this = $(this);
        start_loader();
        
        $.ajax({
            url: _base_url_ + "classes/Master.php?f=save_client",
            data: new FormData($(this)[0]),
            cache: false,
            contentType: false,
            processData: false,
            method: 'POST',
            dataType: 'json',
            error: err => {
                console.log(err);
                alert_toast("An error occurred", 'error');
                end_loader();
            },
            success: function(resp){
                if(resp.status == 'success'){
                    location.reload();
                } else {
                    alert_toast(resp.msg || "An error occurred", 'error');
                }
                end_loader();
            }
        });
    });

    // अगर आप uni_modal का इस्तेमाल कर रहे हैं, तो ये बटन्स को सबमिट ट्रिगर करने में मदद करेगा
    $('#uni_modal #submit').click(function(){
        $('#client-form').submit();
    });
});
</script>