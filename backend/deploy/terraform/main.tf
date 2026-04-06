terraform {
  required_version = ">= 1.5"
  required_providers { aws = { source = "hashicorp/aws", version = "~> 5.0" } }
}
provider "aws" { region = var.aws_region }

resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  enable_dns_hostnames = true
  tags = { Name = "mini-coupon-${var.environment}" }
}
resource "aws_internet_gateway" "main" { vpc_id = aws_vpc.main.id }
resource "aws_subnet" "pub_a" {
  vpc_id = aws_vpc.main.id
  cidr_block = "10.0.1.0/24"
  availability_zone = "${var.aws_region}a"
  map_public_ip_on_launch = true
}
resource "aws_subnet" "pub_b" {
  vpc_id = aws_vpc.main.id
  cidr_block = "10.0.2.0/24"
  availability_zone = "${var.aws_region}b"
  map_public_ip_on_launch = true
}
resource "aws_route_table" "pub" {
  vpc_id = aws_vpc.main.id
  route { cidr_block = "0.0.0.0/0"; gateway_id = aws_internet_gateway.main.id }
}
resource "aws_route_table_association" "a" { subnet_id = aws_subnet.pub_a.id; route_table_id = aws_route_table.pub.id }
resource "aws_route_table_association" "b" { subnet_id = aws_subnet.pub_b.id; route_table_id = aws_route_table.pub.id }

resource "aws_security_group" "alb" {
  vpc_id = aws_vpc.main.id
  ingress { from_port=80; to_port=80; protocol="tcp"; cidr_blocks=["0.0.0.0/0"] }
  ingress { from_port=443; to_port=443; protocol="tcp"; cidr_blocks=["0.0.0.0/0"] }
  egress { from_port=0; to_port=0; protocol="-1"; cidr_blocks=["0.0.0.0/0"] }
}
resource "aws_security_group" "ecs" {
  vpc_id = aws_vpc.main.id
  ingress { from_port=8080; to_port=8080; protocol="tcp"; security_groups=[aws_security_group.alb.id] }
  egress { from_port=0; to_port=0; protocol="-1"; cidr_blocks=["0.0.0.0/0"] }
}
resource "aws_security_group" "db" {
  vpc_id = aws_vpc.main.id
  ingress { from_port=5432; to_port=5432; protocol="tcp"; security_groups=[aws_security_group.ecs.id] }
}
resource "aws_security_group" "cache" {
  vpc_id = aws_vpc.main.id
  ingress { from_port=6379; to_port=6379; protocol="tcp"; security_groups=[aws_security_group.ecs.id] }
}

resource "aws_db_subnet_group" "main" { name = "mini-coupon"; subnet_ids = [aws_subnet.pub_a.id, aws_subnet.pub_b.id] }
resource "aws_db_instance" "postgres" {
  identifier = "mini-coupon-${var.environment}"
  engine = "postgres"; engine_version = "16"
  instance_class = "db.t3.micro"; allocated_storage = 20
  db_name = "viwo_coupon"; username = "viwo"; password = var.db_password
  skip_final_snapshot = true; publicly_accessible = false
  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name = aws_db_subnet_group.main.name
}

resource "aws_elasticache_subnet_group" "main" { name = "mini-coupon"; subnet_ids = [aws_subnet.pub_a.id, aws_subnet.pub_b.id] }
resource "aws_elasticache_cluster" "redis" {
  cluster_id = "mini-coupon-${var.environment}"
  engine = "redis"; node_type = "cache.t3.micro"; num_cache_nodes = 1; port = 6379
  security_group_ids = [aws_security_group.cache.id]
  subnet_group_name = aws_elasticache_subnet_group.main.name
}

resource "aws_ecr_repository" "app" { name = "mini-coupon"; image_tag_mutability = "MUTABLE" }
resource "aws_ecs_cluster" "main" { name = "mini-coupon-${var.environment}" }

resource "aws_iam_role" "ecs_exec" {
  name = "mini-coupon-ecs"
  assume_role_policy = jsonencode({ Version="2012-10-17", Statement=[{Action="sts:AssumeRole",Effect="Allow",Principal={Service="ecs-tasks.amazonaws.com"}}] })
}
resource "aws_iam_role_policy_attachment" "ecs_exec" {
  role = aws_iam_role.ecs_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}
resource "aws_cloudwatch_log_group" "ecs" { name = "/ecs/mini-coupon"; retention_in_days = 14 }

resource "aws_ecs_task_definition" "app" {
  family = "mini-coupon"; requires_compatibilities = ["FARGATE"]
  network_mode = "awsvpc"; cpu = "256"; memory = "512"
  execution_role_arn = aws_iam_role.ecs_exec.arn
  container_definitions = jsonencode([{
    name = "mini-coupon"; image = var.app_image
    portMappings = [{ containerPort = 8080 }]
    environment = [
      {name="POSTGRES_HOST",value=aws_db_instance.postgres.address},
      {name="POSTGRES_PORT",value="5432"},{name="POSTGRES_USER",value="viwo"},
      {name="POSTGRES_PASSWORD",value=var.db_password},{name="POSTGRES_DB",value="viwo_coupon"},
      {name="POSTGRES_SSL_MODE",value="require"},
      {name="REDIS_HOST",value=aws_elasticache_cluster.redis.cache_nodes[0].address},
      {name="REDIS_PORT",value="6379"},
      {name="TELEGRAM_BOT_TOKEN",value=var.telegram_bot_token},
      {name="ENVIRONMENT",value=var.environment}
    ]
    logConfiguration = { logDriver="awslogs", options={"awslogs-group"="/ecs/mini-coupon","awslogs-region"=var.aws_region,"awslogs-stream-prefix"="ecs"} }
  }])
}

resource "aws_lb" "main" {
  name = "mini-coupon"; internal = false; load_balancer_type = "application"
  security_groups = [aws_security_group.alb.id]; subnets = [aws_subnet.pub_a.id, aws_subnet.pub_b.id]
}
resource "aws_lb_target_group" "app" {
  name = "mini-coupon"; port = 8080; protocol = "HTTP"; vpc_id = aws_vpc.main.id; target_type = "ip"
  health_check { path = "/health" }
}
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn; port = 80; protocol = "HTTP"
  default_action { type = "forward"; target_group_arn = aws_lb_target_group.app.arn }
}
resource "aws_ecs_service" "app" {
  name = "mini-coupon"; cluster = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn; desired_count = 1; launch_type = "FARGATE"
  network_configuration { subnets = [aws_subnet.pub_a.id, aws_subnet.pub_b.id]; security_groups = [aws_security_group.ecs.id]; assign_public_ip = true }
  load_balancer { target_group_arn = aws_lb_target_group.app.arn; container_name = "mini-coupon"; container_port = 8080 }
}
