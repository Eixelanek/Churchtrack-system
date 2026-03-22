# Use PHP 8.2 with Apache
FROM php:8.2-apache

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip \
    libzip-dev

# Install PHP extensions
RUN docker-php-ext-install pdo_mysql mysqli mbstring exif pcntl bcmath gd zip

# Larger JSON bodies (base64 profile photos) — post_max must exceed upload payload
RUN printf '%s\n' \
    'memory_limit=256M' \
    'post_max_size=32M' \
    'upload_max_filesize=32M' \
    'max_execution_time=120' \
    'auto_prepend_file=/var/www/html/api/rate_limit_bootstrap.php' \
    > /usr/local/etc/php/conf.d/churchtrack.ini

# Enable Apache mod_rewrite
RUN a2enmod rewrite headers

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www/html

# Copy composer files first
COPY composer.json composer.lock* ./

# Install PHP dependencies (allow failure if composer.lock doesn't exist)
RUN composer install --no-dev --optimize-autoloader --no-interaction || \
    composer install --no-dev --no-interaction || \
    echo "Composer install skipped"

# Copy application files
COPY . /var/www/html/

# Set permissions
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

# Copy Apache configuration
COPY apache-config.conf /etc/apache2/sites-available/000-default.conf

# Expose port
EXPOSE 80

# Start Apache
CMD ["apache2-foreground"]
