from sqlalchemy.orm import Session
from .models import User

def get_level_requirements(level: int) -> int:
    """Return the points required to reach the specified level."""
    return level * 100  # 100 points per level

def get_level_from_points(points: int) -> int:
    """Calculate the level based on total points."""
    return min((points // 100) + 1, 10)  # Cap at level 10

def add_points_to_user(session: Session, user: User, points_to_add: int) -> dict:
    """
    Add points to a user and update their level if needed.
    Returns a dictionary with the updated points, level, and whether the user leveled up.
    """
    if points_to_add <= 0:
        return {
            "points": user.points,
            "level": user.level,
            "leveled_up": False,
            "points_to_next_level": get_level_requirements(user.level) - user.points
        }
    
    # Update points
    new_points = user.points + points_to_add
    new_level = get_level_from_points(new_points)
    
    # Cap at level 10
    if new_level > 10:
        new_level = 10
        new_points = 900  # Cap at 900 points (level 10 requires 900 points)
    
    leveled_up = new_level > user.level
    user.points = new_points
    user.level = new_level
    
    session.commit()
    
    return {
        "points": user.points,
        "level": user.level,
        "leveled_up": leveled_up,
        "points_to_next_level": get_level_requirements(user.level) - user.points
    }

def get_user_stats(user: User) -> dict:
    """Get the user's current stats including points and level."""
    return {
        "points": user.points,
        "level": user.level,
        "points_to_next_level": get_level_requirements(user.level) - user.points,
        "is_max_level": user.level >= 10
    }
