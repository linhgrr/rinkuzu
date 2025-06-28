import connectDB from '@/lib/mongoose'
import Category from '@/models/Category'
import Quiz from '@/models/Quiz'
import { ICategory, ICategoryRepository } from '@/interfaces/repositories/ICategoryRepository'

export class CategoryRepository implements ICategoryRepository {
  async findById(id: string): Promise<ICategory | null> {
    await connectDB()
    return await Category.findById(id).lean() as unknown as ICategory | null
  }

  async findBySlug(slug: string): Promise<ICategory | null> {
    await connectDB()
    
    console.log('CategoryRepository.findBySlug called with slug:', slug);
    
    // Decode the URL-encoded slug
    const decodedSlug = decodeURIComponent(slug);
    console.log('Decoded slug:', decodedSlug);
    
    // Find all active categories and match by slug
    const allCategories = await Category.find({ isActive: true }).lean() as unknown as ICategory[];
    console.log('All active categories:', allCategories.map(c => ({ name: c.name, _id: c._id })));
    
    const category = allCategories.find(cat => {
      const categorySlug = cat.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const inputSlug = decodedSlug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      console.log(`Comparing: "${categorySlug}" with "${inputSlug}"`);
      return categorySlug === inputSlug;
    });
    
    console.log('Found category by slug matching:', category);
    return category || null;
  }

  async findAll(options: {
    page?: number
    limit?: number
    search?: string
    isActive?: boolean
  } = {}): Promise<{
    categories: ICategory[]
    pagination: {
      currentPage: number
      totalPages: number
      totalItems: number
      itemsPerPage: number
      hasNextPage: boolean
      hasPrevPage: boolean
    }
  }> {
    await connectDB()
    
    const page = options.page || 1
    const limit = options.limit || 10
    const skip = (page - 1) * limit

    // Build query
    const query: any = {}
    if (options.search) {
      query.name = { $regex: options.search, $options: 'i' }
    }
    if (typeof options.isActive === 'boolean') {
      query.isActive = options.isActive
    }

    const categories = await Category.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean() as unknown as ICategory[]

    const totalItems = await Category.countDocuments(query)
    const totalPages = Math.ceil(totalItems / limit)

    return {
      categories,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    }
  }

  async findActive(): Promise<ICategory[]> {
    await connectDB()
    return await Category.find({ isActive: true })
      .sort({ name: 1 })
      .lean() as unknown as ICategory[]
  }

  async search(query: string): Promise<ICategory[]> {
    await connectDB()
    return await Category.find({ 
      name: { $regex: query, $options: 'i' },
      isActive: true
    })
      .sort({ name: 1 })
      .lean() as unknown as ICategory[]
  }

  async create(categoryData: Partial<ICategory>): Promise<ICategory> {
    await connectDB()
    const category = new Category(categoryData)
    return await category.save() as unknown as ICategory
  }

  async update(id: string, categoryData: Partial<ICategory>): Promise<ICategory | null> {
    await connectDB()
    return await Category.findByIdAndUpdate(id, categoryData, { new: true }).lean() as unknown as ICategory | null
  }

  async delete(id: string): Promise<boolean> {
    await connectDB()
    const result = await Category.findByIdAndDelete(id)
    return !!result
  }

  async count(filter: any = {}): Promise<number> {
    await connectDB()
    return await Category.countDocuments(filter)
  }

  async findWithQuizCount(): Promise<{ category: ICategory; quizCount: number }[]> {
    await connectDB()
    const result = await Category.aggregate([
      {
        $lookup: {
          from: 'quizzes',
          localField: '_id',
          foreignField: 'category',
          as: 'quizzes'
        }
      },
      {
        $project: {
          name: 1,
          slug: 1,
          description: 1,
          color: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          quizCount: { $size: '$quizzes' }
        }
      },
      {
        $sort: { name: 1 }
      }
    ])

    return result.map(item => ({
      category: {
        _id: item._id,
        name: item.name,
        slug: item.slug,
        description: item.description,
        color: item.color,
        isActive: item.isActive,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      },
      quizCount: item.quizCount
    }))
  }

  async getStatsWithQuizCount(): Promise<any[]> {
    await connectDB()
    const result = await Category.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $lookup: {
          from: 'quizzes',
          localField: '_id',
          foreignField: 'category',
          pipeline: [
            {
              $match: { 
                status: 'published',
                isPrivate: { $ne: true }
              }
            }
          ],
          as: 'quizzes'
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          color: 1,
          slug: {
            $toLower: {
              $replaceAll: {
                input: '$name',
                find: ' ',
                replacement: '-'
              }
            }
          },
          quizCount: { $size: '$quizzes' },
          isActive: 1,
          createdAt: 1,
          updatedAt: 1
        }
      },
      {
        $sort: { quizCount: -1, name: 1 }
      }
    ])

    return result
  }
} 