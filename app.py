"""
ChronoMaster Pro - Python Backend API
Advanced date manipulation with timezone support
@version 1.0.0
@author ChronoMaster Team
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta
import pytz
import re
from dateutil import parser
import logging
from typing import Dict, Any, Optional
import unicodedata

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# ==========================================================================
# CONSTANTS & CONFIGURATION
# ==========================================================================

SUPPORTED_TIMEZONES = {
    'EST': 'US/Eastern',
    'PST': 'US/Pacific', 
    'CST': 'US/Central',
    'MST': 'US/Mountain',
    'UTC': 'UTC',
    'GMT': 'GMT'
}

MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]

# ==========================================================================
# DATE PARSING & MANIPULATION CORE
# ==========================================================================

class DateParser:
    """Advanced date parsing with multiple format support"""
    
    @staticmethod
    def parse_date_string(date_string: str) -> Dict[str, Any]:
        """
        Parse date string in format "March 6 2009 7:30pm EST"
        Returns dict with parsed components
        """
        try:
            # Normalize string
            date_string = unicodedata.normalize('NFKC', date_string.strip())
            
            # Split components
            parts = date_string.split()
            if len(parts) < 5:
                raise ValueError("Insufficient date components")
            
            month_name = parts[0]
            day = int(parts[1])
            year = int(parts[2])
            time_string = parts[3]
            timezone = parts[4].upper()
            
            # Parse time
            time_match = re.match(r'(\d{1,2}):(\d{2})(am|pm)', time_string, re.IGNORECASE)
            if not time_match:
                raise ValueError("Invalid time format")
            
            hour = int(time_match.group(1))
            minute = int(time_match.group(2))
            ampm = time_match.group(3).lower()
            
            # Convert to 24-hour format
            if ampm == 'pm' and hour != 12:
                hour += 12
            elif ampm == 'am' and hour == 12:
                hour = 0
            
            # Validate components
            if month_name not in MONTHS:
                raise ValueError(f"Invalid month: {month_name}")
            if day < 1 or day > 31:
                raise ValueError(f"Invalid day: {day}")
            if timezone not in SUPPORTED_TIMEZONES:
                raise ValueError(f"Unsupported timezone: {timezone}")
            
            return {
                'year': year,
                'month': MONTHS.index(month_name) + 1,
                'day': day,
                'hour': hour,
                'minute': minute,
                'timezone': timezone,
                'original_string': date_string
            }
            
        except Exception as e:
            logger.error(f"Date parsing failed: {e}")
            raise ValueError(f"Date parsing failed: {str(e)}")

class DateManipulator:
    """Core date manipulation operations"""
    
    @staticmethod
    def add_hours(parsed_date: Dict[str, Any], hours_to_add: int) -> datetime:
        """Add hours to parsed date, handling timezone conversions"""
        try:
            # Get timezone
            tz_name = SUPPORTED_TIMEZONES[parsed_date['timezone']]
            tz = pytz.timezone(tz_name)
            
            # Create timezone-aware datetime
            local_dt = tz.localize(datetime(
                parsed_date['year'],
                parsed_date['month'],
                parsed_date['day'],
                parsed_date['hour'],
                parsed_date['minute']
            ))
            
            # Add hours
            new_dt = local_dt + timedelta(hours=hours_to_add)
            
            return new_dt
            
        except Exception as e:
            logger.error(f"Date manipulation failed: {e}")
            raise ValueError(f"Date manipulation failed: {str(e)}")
    
    @staticmethod
    def format_date(dt: datetime, timezone: str) -> str:
        """Format datetime back to string format"""
        try:
            # Convert to target timezone if needed
            if timezone in SUPPORTED_TIMEZONES:
                tz_name = SUPPORTED_TIMEZONES[timezone]
                tz = pytz.timezone(tz_name)
                dt = dt.astimezone(tz)
            
            # Format components
            month_name = MONTHS[dt.month - 1]
            day = dt.day
            year = dt.year
            
            # Convert to 12-hour format
            hour = dt.hour
            minute = dt.minute
            
            if hour == 0:
                hour = 12
                ampm = 'am'
            elif hour == 12:
                ampm = 'pm'
            elif hour > 12:
                hour -= 12
                ampm = 'pm'
            else:
                ampm = 'am'
            
            minute_str = str(minute).zfill(2)
            
            return f"{month_name} {day} {year} {hour}:{minute_str}{ampm} {timezone}"
            
        except Exception as e:
            logger.error(f"Date formatting failed: {e}")
            raise ValueError(f"Date formatting failed: {str(e)}")

class DateValidator:
    """Comprehensive date validation"""
    
    @staticmethod
    def validate_date_string(date_string: str) -> Dict[str, Any]:
        """Validate date string format and components"""
        try:
            parsed = DateParser.parse_date_string(date_string)
            
            # Additional validation
            try:
                # Try to create a valid date
                datetime(parsed['year'], parsed['month'], parsed['day'], 
                        parsed['hour'], parsed['minute'])
            except ValueError as e:
                return {
                    'valid': False,
                    'message': f"Invalid date components: {str(e)}"
                }
            
            return {
                'valid': True,
                'message': 'Date format is valid',
                'parsed': parsed
            }
            
        except Exception as e:
            return {
                'valid': False,
                'message': str(e)
            }

# ==========================================================================
# API ENDPOINTS
# ==========================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now(pytz.UTC).isoformat(),
        'version': '1.0.0'
    })

@app.route('/api/calculate', methods=['POST'])
def calculate_date():
    """
    Calculate new date by adding hours
    Expected JSON: {
        "date_string": "March 6 2009 7:30pm EST",
        "hours_to_add": 12,
        "timezone": "EST"
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        # Validate required fields
        required_fields = ['date_string', 'hours_to_add', 'timezone']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        date_string = data['date_string']
        hours_to_add = int(data['hours_to_add'])
        timezone = data['timezone']
        
        # Validate timezone
        if timezone not in SUPPORTED_TIMEZONES:
            return jsonify({'error': f'Unsupported timezone: {timezone}'}), 400
        
        # Parse date
        parsed_date = DateParser.parse_date_string(date_string)
        
        # Manipulate date
        new_datetime = DateManipulator.add_hours(parsed_date, hours_to_add)
        
        # Format result
        new_date_string = DateManipulator.format_date(new_datetime, timezone)
        
        # Calculate additional info
        time_difference = hours_to_add
        direction = 'added' if time_difference > 0 else 'subtracted'
        
        response = {
            'success': True,
            'original_date': date_string,
            'new_date': new_date_string,
            'hours_added': time_difference,
            'timezone': timezone,
            'timestamp': datetime.now(pytz.UTC).isoformat(),
            'method': 'server-side',
            'details': {
                'direction': direction,
                'time_difference': abs(time_difference),
                'parsed_components': parsed_date
            }
        }
        
        logger.info(f"Date calculation successful: {date_string} +{hours_to_add}h = {new_date_string}")
        return jsonify(response)
        
    except ValueError as e:
        logger.error(f"Date calculation validation error: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'method': 'server-side'
        }), 400
        
    except Exception as e:
        logger.error(f"Date calculation error: {e}")
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'method': 'server-side'
        }), 500

@app.route('/api/validate', methods=['POST'])
def validate_date():
    """
    Validate date string format
    Expected JSON: {"date_string": "March 6 2009 7:30pm EST"}
    """
    try:
        data = request.get_json()
        
        if not data or 'date_string' not in data:
            return jsonify({'error': 'No date_string provided'}), 400
        
        date_string = data['date_string']
        validation_result = DateValidator.validate_date_string(date_string)
        
        response = {
            'success': True,
            'validation': validation_result,
            'timestamp': datetime.now(pytz.UTC).isoformat()
        }
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Validation error: {e}")
        return jsonify({
            'success': False,
            'error': 'Validation failed',
            'message': str(e)
        }), 500

@app.route('/api/convert-timezone', methods=['POST'])
def convert_timezone():
    """
    Convert date between timezones
    Expected JSON: {
        "date_string": "March 6 2009 7:30pm EST",
        "source_timezone": "EST",
        "target_timezone": "PST"
    }
    """
    try:
        data = request.get_json()
        
        required_fields = ['date_string', 'source_timezone', 'target_timezone']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        date_string = data['date_string']
        source_tz = data['source_timezone']
        target_tz = data['target_timezone']
        
        # Validate timezones
        if source_tz not in SUPPORTED_TIMEZONES or target_tz not in SUPPORTED_TIMEZONES:
            return jsonify({'error': 'Invalid timezone specified'}), 400
        
        # Parse date
        parsed_date = DateParser.parse_date_string(date_string)
        
        # Get timezone objects
        source_timezone = pytz.timezone(SUPPORTED_TIMEZONES[source_tz])
        target_timezone = pytz.timezone(SUPPORTED_TIMEZONES[target_tz])
        
        # Create datetime in source timezone
        source_dt = source_timezone.localize(datetime(
            parsed_date['year'], parsed_date['month'], parsed_date['day'],
            parsed_date['hour'], parsed_date['minute']
        ))
        
        # Convert to target timezone
        target_dt = source_dt.astimezone(target_timezone)
        
        # Format result
        converted_string = DateManipulator.format_date(target_dt, target_tz)
        
        response = {
            'success': True,
            'original_date': date_string,
            'converted_date': converted_string,
            'source_timezone': source_tz,
            'target_timezone': target_tz,
            'timestamp': datetime.now(pytz.UTC).isoformat()
        }
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Timezone conversion error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/batch-calculate', methods=['POST'])
def batch_calculate():
    """
    Batch calculate multiple date operations
    Expected JSON: {
        "operations": [
            {
                "date_string": "March 6 2009 7:30pm EST",
                "hours_to_add": 12,
                "timezone": "EST"
            }
        ]
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'operations' not in data:
            return jsonify({'error': 'No operations provided'}), 400
        
        operations = data['operations']
        if not isinstance(operations, list) or len(operations) > 100:
            return jsonify({'error': 'Invalid operations format or too many operations'}), 400
        
        results = []
        
        for i, operation in enumerate(operations):
            try:
                required_fields = ['date_string', 'hours_to_add', 'timezone']
                for field in required_fields:
                    if field not in operation:
                        raise ValueError(f'Missing field in operation {i}: {field}')
                
                parsed_date = DateParser.parse_date_string(operation['date_string'])
                new_datetime = DateManipulator.add_hours(parsed_date, operation['hours_to_add'])
                new_date_string = DateManipulator.format_date(new_datetime, operation['timezone'])
                
                results.append({
                    'index': i,
                    'success': True,
                    'original_date': operation['date_string'],
                    'new_date': new_date_string,
                    'hours_added': operation['hours_to_add'],
                    'timezone': operation['timezone']
                })
                
            except Exception as e:
                results.append({
                    'index': i,
                    'success': False,
                    'error': str(e),
                    'original_date': operation.get('date_string', 'unknown')
                })
        
        response = {
            'success': True,
            'results': results,
            'total_operations': len(operations),
            'successful_operations': len([r for r in results if r['success']]),
            'timestamp': datetime.now(pytz.UTC).isoformat()
        }
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Batch calculation error: {e}")
        return jsonify({
            'success': False,
            'error': 'Batch calculation failed',
            'message': str(e)
        }), 500

# ==========================================================================
# ERROR HANDLERS
# ==========================================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'error': 'Endpoint not found',
        'available_endpoints': [
            '/api/health',
            '/api/calculate',
            '/api/validate',
            '/api/convert-timezone',
            '/api/batch-calculate'
        ]
    }), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {error}")
    return jsonify({
        'error': 'Internal server error',
        'message': 'An unexpected error occurred'
    }), 500

# ==========================================================================
# MAIN
# ==========================================================================

if __name__ == '__main__':
    logger.info("🚀 ChronoMaster Pro API Server starting...")
    logger.info(f"Supported timezones: {list(SUPPORTED_TIMEZONES.keys())}")
    
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        threaded=True
    )
