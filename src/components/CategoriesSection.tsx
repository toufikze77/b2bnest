
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { templateService } from "@/services/templateService";

const CategoriesSection = () => {
  const categories = templateService.getCategories();

  const getCategoryLink = (categoryId: string) => {
    const linkMap: { [key: string]: string } = {
      'legal': '/categories/legal',
      'hr': '/categories/hr',
      'finance': '/categories/finance',
      'marketing': '/categories/marketing',
      'operations': '/categories/operations',
      'business-resources': '/business-tools',
      'project-management': '/business-tools',
      'professional-services': '/business-tools'
    };
    return linkMap[categoryId] || '/business-tools';
  };

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Browse by Category
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((category) => {
            const templateCount = templateService.getTemplatesByCategory(category.id).length;
            return (
              <Link key={category.id} to={getCategoryLink(category.id)}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer group h-full">
                  <CardHeader className="text-center pb-4">
                    <div className={`${category.color} w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                      <FileText className="h-8 w-8 text-white" />
                    </div>
                    <CardTitle className="text-xl">{category.name}</CardTitle>
                    <CardDescription>{category.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-center pt-0">
                    <Badge variant="secondary" className="text-sm">
                      {templateCount} templates
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CategoriesSection;
