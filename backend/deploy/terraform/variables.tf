variable "aws_region" { default = "me-south-1" }
variable "environment" { default = "dev" }
variable "db_password" { sensitive = true }
variable "telegram_bot_token" { sensitive = true }
variable "app_image" { description = "ECR image URI" }
